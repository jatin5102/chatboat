import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import type { Client, Message } from 'whatsapp-web.js';
import { sessionService } from './session.service.js';
import { watermarkService } from './watermark.service.js';
import { PROPERTIES, getPropertyById } from '../config/properties.js';
import { ChatStep } from '../types/index.js';
import path from 'node:path';

function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length >= 11 && digits.startsWith('44')) {
    return `+44 ${digits.slice(2)}`;
  }
  if (digits.length >= 12 && digits.startsWith('971')) {
    return `+971 ${digits.slice(3)}`;
  }
  return `+${digits}`;
}

/**
 * Resolves the user's actual phone number.
 * Modern WhatsApp Web uses internal @lid identifiers for linked devices and privacy.
 * This resolver converts @lid -> actual phone number (PN).
 */
export async function resolveRealPhoneNumber(
  client: Client,
  message: Message
): Promise<string> {
  const from = message.from;

  // 1. If message.from already ends with @c.us, it is directly the real phone number
  if (from && from.endsWith('@c.us')) {
    const rawNum = from.replace('@c.us', '').replace(/\D/g, '');
    if (rawNum.length >= 10 && rawNum.length <= 13) {
      return rawNum;
    }
  }

  // 2. Query WhatsApp Web's internal LID-to-Phone resolver via client
  try {
    if (typeof (client as any).getContactLidAndPhone === 'function') {
      const res = await (client as any).getContactLidAndPhone(from);
      if (Array.isArray(res) && res.length > 0 && res[0]?.pn) {
        const pnDigits = res[0].pn.replace(/@.*$/, '').replace(/\D/g, '');
        if (pnDigits.length >= 10 && pnDigits.length <= 13) {
          console.log(`[Phone Resolver] Successfully mapped LID ${from} -> Real Phone: ${pnDigits}`);
          return pnDigits;
        }
      }
    }
  } catch (err) {
    console.warn('[Phone Resolver] getContactLidAndPhone error:', err);
  }

  // 3. Query Contact model
  try {
    const contact = await message.getContact();
    if (contact) {
      if (contact.number && /^\d{10,13}$/.test(contact.number)) {
        return contact.number;
      }
      if (contact.id?.server === 'c.us' && /^\d{10,13}$/.test(contact.id.user)) {
        return contact.id.user;
      }
      if (typeof contact.getFormattedNumber === 'function') {
        const formatted = await contact.getFormattedNumber();
        const digits = formatted.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 13) {
          return digits;
        }
      }
    }
  } catch (err) {
    console.warn('[Phone Resolver] getContact error:', err);
  }

  // 4. Fallback: inspect raw message _data
  const msgData = (message as any)._data;
  if (msgData) {
    const candidates = [
      msgData.id?.participant,
      msgData.author,
      msgData.from,
      msgData.to
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.endsWith('@c.us')) {
        const d = c.replace('@c.us', '').replace(/\D/g, '');
        if (d.length >= 10 && d.length <= 13) {
          return d;
        }
      }
    }
  }

  // 5. Ultimate fallback: remove @... suffix
  return from.replace(/@.*$/, '').replace(/\D/g, '');
}

export class BotService {
  public async handleMessage(client: Client, message: Message): Promise<void> {
    // Ignore group messages, status updates, or broadcast messages
    if (message.from.endsWith('@g.us') || message.isStatus || message.from === 'status@broadcast') {
      return;
    }

    const rawText = (message.body || '').trim();
    const chatId = message.from;
    const realPhone = await resolveRealPhoneNumber(client, message);
    const session = sessionService.getSession(chatId, realPhone);

    if (realPhone && (!session.phone || session.phone.length > 13 || session.phone !== realPhone)) {
      sessionService.updateSession(chatId, { phone: realPhone });
    }

    const lowerText = rawText.toLowerCase();

    // Global reset keywords
    if (['restart', 'reset'].includes(lowerText)) {
      sessionService.resetSession(chatId, realPhone);
      await this.sendWelcomeAndAskName(client, message.from);
      return;
    }

    // Main conversation step machine
    switch (session.step) {
      case ChatStep.INITIAL: {
        await this.sendWelcomeAndAskName(client, message.from);
        break;
      }

      case ChatStep.AWAITING_NAME: {
        if (!rawText || rawText.length < 2) {
          await client.sendMessage(
            message.from,
            '⚠️ Please enter a valid full name to proceed.'
          );
          return;
        }

        sessionService.updateSession(chatId, {
          name: rawText,
          step: ChatStep.AWAITING_LOCATION
        });

        const displayPhone = formatPhone(session.phone || realPhone);
        await client.sendMessage(
          message.from,
          `Nice to connect with you, *${rawText}*! 😊\n` +
          `📱 Registered WhatsApp: *${displayPhone}*\n\n` +
          `Which *City or Locality* are you currently exploring properties in?\n*(e.g. Gurgaon, Bangalore, Mumbai, Pune, Noida)*`
        );
        break;
      }

      case ChatStep.AWAITING_LOCATION: {
        if (!rawText || rawText.length < 2) {
          await client.sendMessage(
            message.from,
            '⚠️ Please enter your preferred city or location.'
          );
          return;
        }

        sessionService.updateSession(chatId, {
          location: rawText,
          step: ChatStep.AWAITING_ROLE
        });

        await client.sendMessage(
          message.from,
          `Got it! Location recorded: *${rawText}* 📍\n\nCould you please let us know your profile?\n\n1️⃣ I am a *Home Buyer / Property Investor*\n2️⃣ I am a *Channel Partner / Real Estate Broker*\n\n👉 *Reply with 1 or 2*`
        );
        break;
      }

      case ChatStep.AWAITING_ROLE: {
        if (rawText === '1') {
          sessionService.updateSession(chatId, {
            role: 'BUYER',
            step: ChatStep.AWAITING_PROPERTY_SELECTION
          });
          await client.sendMessage(
            message.from,
            `Thank you! We have matched premier residential projects suited for home buyers. 🏡`
          );
          await this.sendPropertyList(client, message.from);
        } else if (rawText === '2') {
          sessionService.updateSession(chatId, {
            role: 'CHANNEL_PARTNER',
            step: ChatStep.AWAITING_RERA
          });
          await client.sendMessage(
            message.from,
            `Welcome, Partner! 🤝\nPlease enter your *RERA Registration Number* or *Agency Name* for our broker desk records:`
          );
        } else {
          await client.sendMessage(
            message.from,
            '⚠️ Invalid option. Please reply with *1* for Home Buyer or *2* for Channel Partner.'
          );
        }
        break;
      }

      case ChatStep.AWAITING_RERA: {
        if (!rawText || rawText.length < 3) {
          await client.sendMessage(
            message.from,
            '⚠️ Please enter your valid RERA number or Agency name.'
          );
          return;
        }

        sessionService.updateSession(chatId, {
          reraNumber: rawText,
          step: ChatStep.AWAITING_PROPERTY_SELECTION
        });

        await client.sendMessage(
          message.from,
          `Thank you! Partner verified: *${rawText}* ✅\nAccessing exclusive partner collateral & project inventory...`
        );
        await this.sendPropertyList(client, message.from);
        break;
      }

      case ChatStep.AWAITING_PROPERTY_SELECTION: {
        const choice = parseInt(rawText, 10);
        if (isNaN(choice) || choice < 1 || choice > PROPERTIES.length) {
          await client.sendMessage(
            message.from,
            `⚠️ Invalid selection. Please reply with a number between 1 and ${PROPERTIES.length}.`
          );
          await this.sendPropertyList(client, message.from);
          return;
        }

        const selectedProp = PROPERTIES[choice - 1];
        sessionService.updateSession(chatId, {
          selectedPropertyId: selectedProp.id,
          step: ChatStep.PROPERTY_MENU
        });

        await this.sendPropertyMenu(client, message.from, selectedProp);
        break;
      }

      case ChatStep.PROPERTY_MENU: {
        const currentProp = getPropertyById(session.selectedPropertyId || '');
        if (!currentProp) {
          sessionService.updateSession(chatId, {
            step: ChatStep.AWAITING_PROPERTY_SELECTION
          });
          await this.sendPropertyList(client, message.from);
          return;
        }

        await this.handlePropertyMenuChoice(
          client,
          message.from,
          rawText,
          currentProp,
          session.name || 'Client',
          session.phone || realPhone
        );
        break;
      }

      default: {
        await this.sendWelcomeAndAskName(client, message.from);
        break;
      }
    }
  }

  private async sendWelcomeAndAskName(client: Client, to: string): Promise<void> {
    sessionService.updateSession(to, { step: ChatStep.AWAITING_NAME });

    const welcomeMsg =
      `👋 *Welcome to Apex Prime Realty Advisory!*\n\n` +
      `We specialize in verified luxury properties with instant digital collaterals, verified brochures, and personalized pricing.\n\n` +
      `To get started, may I please know your *Full Name*?`;

    await client.sendMessage(to, welcomeMsg);
  }

  private async sendPropertyList(client: Client, to: string): Promise<void> {
    let listText = `🏢 *FEATURED EXCLUSIVE DEVELOPMENTS*\n\n`;

    PROPERTIES.forEach((prop, idx) => {
      listText += `*${idx + 1}️⃣ ${prop.name}*\n`;
      listText += `   📍 Location: ${prop.location}\n`;
      listText += `   💰 Range: ${prop.priceRange}\n`;
      listText += `   🌟 Highlights: ${prop.tagline}\n\n`;
    });

    listText += `👉 *Reply with 1 or 2 to view details & download media:*`;

    await client.sendMessage(to, listText);
  }

  private async sendPropertyMenu(
    client: Client,
    to: string,
    prop: (typeof PROPERTIES)[0]
  ): Promise<void> {
    const menuText =
      `🏢 *${prop.name.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Location:* ${prop.location}\n` +
      `💰 *Price Range:* ${prop.priceRange}\n` +
      `📜 *RERA No:* ${prop.reraNumber}\n\n` +
      `📝 *Overview:* ${prop.description}\n\n` +
      `*What would you like to receive?*\n` +
      `1️⃣ 📄 *Download Official Brochure* (Personalized PDF with your Name & Phone)\n` +
      `2️⃣ 🖼️ *View Image Gallery* (Watermarked with your Name & Phone)\n` +
      `3️⃣ 🌟 *Key Amenities & Specifications*\n` +
      `4️⃣ 🔄 *Choose Another Property*\n` +
      `5️⃣ 🔁 *Start Over / Update Profile*\n` +
      `6️⃣ 📞 *Request a Callback from Relationship Manager*\n\n` +
      `👉 *Reply with a number (1 - 6):*`;

    await client.sendMessage(to, menuText);
  }

  private async handlePropertyMenuChoice(
    client: Client,
    to: string,
    choice: string,
    prop: (typeof PROPERTIES)[0],
    userName: string,
    userPhone: string
  ): Promise<void> {
    const formattedPhone = formatPhone(userPhone);

    switch (choice) {
      case '1': {
        // PDF Brochure with dynamic watermark
        await client.sendMessage(
          to,
          `⏳ *Generating your personalized brochure for ${userName} (${formattedPhone})...*`
        );

        try {
          const watermarkedPdfBuffer = await watermarkService.watermarkPdf(
            prop.brochurePath,
            userName,
            formattedPhone
          );

          const pdfFileName = `${prop.name.replace(/[^a-zA-Z0-9]/g, '_')}_Brochure.pdf`;
          const media = new MessageMedia(
            'application/pdf',
            watermarkedPdfBuffer.toString('base64'),
            pdfFileName
          );

          const pdfCaption =
            `📄 *Official Brochure: ${prop.name}*\n` +
            `👤 Exclusively personalized for: *${userName}*\n` +
            `📞 Phone: *${formattedPhone}*\n\n` +
            `Reply *menu* anytime to view other options.`;

          try {
            await client.sendMessage(to, media, {
              caption: pdfCaption,
              sendMediaAsDocument: true
            });
          } catch (captionErr) {
            console.warn('Retrying PDF send as document without caption:', captionErr);
            await client.sendMessage(to, media, { sendMediaAsDocument: true });
            await client.sendMessage(to, pdfCaption);
          }
        } catch (err: any) {
          console.error('Error sending watermarked PDF:', err);
          await client.sendMessage(
            to,
            `⚠️ Could not generate personalized PDF: ${err.message}`
          );
        }
        break;
      }

      case '2': {
        // Images with dynamic watermark overlay
        await client.sendMessage(
          to,
          `⏳ *Personalizing and stamping ${prop.imagePaths.length} high-res gallery images with your details...*`
        );

        try {
          for (let i = 0; i < prop.imagePaths.length; i++) {
            const imgPath = prop.imagePaths[i];
            const watermarkedImgBuffer = await watermarkService.watermarkImage(
              imgPath,
              userName,
              formattedPhone
            );

            const imgBaseName = path.basename(imgPath);
            const media = new MessageMedia(
              'image/jpeg',
              watermarkedImgBuffer.toString('base64'),
              imgBaseName
            );

            const imgCaption =
              `🖼️ *${prop.name}* (Photo ${i + 1}/${prop.imagePaths.length})\n` +
              `👤 Watermarked for: *${userName}* | 📞 *${formattedPhone}*`;

            try {
              await client.sendMessage(to, media, { caption: imgCaption });
            } catch (imgErr) {
              console.warn('Retrying image send without caption:', imgErr);
              await client.sendMessage(to, media);
              await client.sendMessage(to, imgCaption);
            }
          }

          await client.sendMessage(
            to,
            `✅ All personalized gallery images have been sent.\nReply *menu* to open the property options again.`
          );
        } catch (err: any) {
          console.error('Error sending watermarked images:', err);
          await client.sendMessage(
            to,
            `⚠️ Error processing images: ${err.message}`
          );
        }
        break;
      }

      case '3': {
        // Amenities list
        let amenitiesMsg = `🌟 *AMENITIES & PROJECT FEATURES - ${prop.name}*\n\n`;
        prop.amenities.forEach((amenity) => {
          amenitiesMsg += `✔️ ${amenity}\n`;
        });
        amenitiesMsg += `\n📜 *RERA ID:* ${prop.reraNumber}\n\n`;
        amenitiesMsg += `Reply with *1* for Brochure, *2* for Images, or *4* to view other properties.`;

        await client.sendMessage(to, amenitiesMsg);
        break;
      }

      case '4': {
        sessionService.updateSession(to, {
          step: ChatStep.AWAITING_PROPERTY_SELECTION,
          selectedPropertyId: undefined
        });
        await this.sendPropertyList(client, to);
        break;
      }

      case '5': {
        sessionService.resetSession(to, userPhone);
        await this.sendWelcomeAndAskName(client, to);
        break;
      }

      case '6': {
        await client.sendMessage(
          to,
          `📞 *Callback Request Received!*\n\n` +
          `Thank you *${userName}*! Our Senior Real Estate Specialist for *${prop.name}* has been alerted and will reach out to *${userPhone}* within 15 minutes.`
        );
        break;
      }

      default: {
        // If user typed 'menu', show menu again
        await this.sendPropertyMenu(client, to, prop);
        break;
      }
    }
  }
}

export const botService = new BotService();
