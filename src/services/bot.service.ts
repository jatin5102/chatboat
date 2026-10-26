import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import type { Client, Message } from 'whatsapp-web.js';
import { sessionService } from './session.service.js';
import { watermarkService } from './watermark.service.js';
import { projectService, BotProject } from './project.service.js';
import { platterService } from './platter.service.js';
import { channelPartnerService } from './channelPartner.service.js';
import { faqService } from './faq.service.js';
import { collateralService, CollateralItem } from './collateral.service.js';
import { chatRecordService } from './chatRecord.service.js';
import { ChatStep } from '../types/index.js';

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
  private readyTimestamp: number = Math.floor(Date.now() / 1000);

  public setReadyTimestamp(ts: number = Math.floor(Date.now() / 1000)): void {
    this.readyTimestamp = ts;
  }

  /**
   * Helper to send an outgoing WhatsApp message and log it in the database.
   */
  public async reply(
    client: Client,
    to: string,
    text: string,
    step: string
  ): Promise<void> {
    try {
      await client.sendMessage(to, text);
      await chatRecordService.recordOutgoingMessage(to, text, step, 'text');
    } catch (err: any) {
      console.error(`[Bot] Error sending message to ${to}:`, err.message);
      if (to.endsWith('@lid')) {
        const digits = to.replace(/\D/g, '');
        if (digits.length >= 10 && digits.length <= 13) {
          try {
            await client.sendMessage(`${digits}@c.us`, text);
            await chatRecordService.recordOutgoingMessage(`${digits}@c.us`, text, step, 'text');
            return;
          } catch {}
        }
      }
      throw err;
    }
  }

  public async handleMessage(client: Client, message: Message): Promise<void> {
    // 1. Ignore messages sent by own WhatsApp account
    if (message.fromMe) {
      return;
    }

    // 2. Ignore group messages, status updates, or broadcast messages
    if (
      message.from.endsWith('@g.us') ||
      message.isStatus ||
      message.from === 'status@broadcast' ||
      (message as any).broadcast
    ) {
      return;
    }

    // 3. Ignore system / non-chat event messages (e2e notices, reactions, calls)
    if (['e2e_notification', 'notification_template', 'call_log', 'reaction', 'gp2'].includes(message.type)) {
      return;
    }

    // 4. Ignore old historical backlog messages (older than 2 minutes / 120s from offline sync)
    const nowSec = Math.floor(Date.now() / 1000);
    if (message.timestamp && (nowSec - message.timestamp > 120)) {
      console.log(
        `[Bot] Ignored old message from ${message.from} (sent ${nowSec - message.timestamp}s ago)`
      );
      return;
    }

    const rawText = (message.body || '').trim();
    const chatId = message.from;
    const realPhone = await resolveRealPhoneNumber(client, message);
    const session = await sessionService.getSession(chatId, realPhone);

    if (realPhone && (!session.phone || session.phone.length > 13 || session.phone !== realPhone)) {
      await sessionService.updateSession(chatId, { phone: realPhone });
    }

    // Persist incoming message to DB
    await chatRecordService.recordIncomingMessage(chatId, rawText, session.step);

    const lowerText = rawText.toLowerCase();

    // Global reset keywords
    if (['restart', 'reset'].includes(lowerText)) {
      await sessionService.resetSession(chatId, realPhone);
      await this.sendInitialWelcome(client, chatId);
      return;
    }

    // Direct FAQ trigger anytime
    if (lowerText === 'faq' || lowerText === 'faqs' || lowerText === 'help') {
      await this.sendFaqMenu(client, chatId);
      return;
    }

    // Main Menu trigger anytime
    if (lowerText === 'menu' || lowerText === 'main menu' || lowerText === 'start') {
      if (session.name && session.firmName) {
        await this.sendPlatterMenu(client, chatId, session.name);
        return;
      }
      await this.sendInitialWelcome(client, chatId);
      return;
    }

    // Common greeting words
    const greetingWords = [
      'hi', 'hello', 'hey', 'namaste', 'hola', 'good morning', 'good afternoon', 'good evening', 'info', 'start'
    ];
    const isGreeting =
      greetingWords.includes(lowerText) ||
      lowerText === 'hi' ||
      lowerText.startsWith('hi ') ||
      lowerText.startsWith('hello ') ||
      lowerText.startsWith('hey ');

    // When user says "hi" / greeting OR is at INITIAL step:
    if (isGreeting || session.step === ChatStep.INITIAL) {
      if (session.channelPartnerId || (session.name && session.firmName && session.reraNumber)) {
        await this.sendPlatterMenu(client, chatId, session.name || session.firmName || 'Partner');
      } else {
        // Auto-check if incoming phone number matches an admin-registered channel partner
        const cleanPhone = (session.phone || realPhone || '').replace(/\D/g, '').slice(-10);
        const existingCp = cleanPhone.length >= 10 ? await channelPartnerService.findByPhone(cleanPhone) : null;
        if (existingCp && existingCp.status) {
          await sessionService.updateSession(chatId, {
            channelPartnerId: existingCp.id,
            name: existingCp.fullName,
            firmName: existingCp.firmName,
            reraNumber: existingCp.reraNumber,
            step: ChatStep.SELECT_PLATTER,
          });
          await this.sendChannelPartnerVerified(
            client,
            chatId,
            existingCp.fullName,
            existingCp.firmName,
            existingCp.reraNumber,
            session.phone || realPhone
          );
        } else {
          await this.sendChannelPartnerList(client, chatId);
        }
      }
      return;
    }

    // State Machine
    switch (session.step) {
      // Step: Select registered Channel Partner (Admin only creates, user only chooses)
      case ChatStep.CHOOSE_CHANNEL_PARTNER:
      case ChatStep.AWAITING_NAME:
      case ChatStep.AWAITING_RERA:
      case ChatStep.AWAITING_FIRM_NAME: {
        const partners = await channelPartnerService.getAll();
        const activePartners = partners.filter((p) => p.status);
        const choiceNum = parseInt(rawText.trim(), 10);

        let selectedPartner: any = null;

        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= activePartners.length) {
          selectedPartner = activePartners[choiceNum - 1];
        } else {
          const searchInput = rawText.trim().toUpperCase();
          selectedPartner = activePartners.find(
            (p) =>
              p.reraNumber.toUpperCase() === searchInput ||
              p.firmName.toUpperCase().includes(searchInput) ||
              p.fullName.toUpperCase().includes(searchInput)
          );
        }

        if (selectedPartner) {
          await sessionService.updateSession(chatId, {
            channelPartnerId: selectedPartner.id,
            name: selectedPartner.fullName,
            firmName: selectedPartner.firmName,
            reraNumber: selectedPartner.reraNumber,
            step: ChatStep.SELECT_PLATTER,
          });

          await this.sendChannelPartnerVerified(
            client,
            chatId,
            selectedPartner.fullName,
            selectedPartner.firmName,
            selectedPartner.reraNumber,
            session.phone || realPhone
          );
          return;
        }

        await this.reply(
          client,
          chatId,
          `⚠️ *Channel Partner Profile Not Found!*\n\n` +
          `❌ Channel Partners cannot be registered manually by users. Profiles are authorized and managed by *M3M Admin only*.\n\n` +
          `👉 Please reply with a valid number from *1 to ${activePartners.length}* to select your firm from the list, or contact your M3M Relationship Manager to get registered.`,
          ChatStep.CHOOSE_CHANNEL_PARTNER
        );
        break;
      }

      // Step 1 / Platter Selection (Residential vs Commerci`al)
      case ChatStep.SELECT_PLATTER: {
        if (rawText === '1' || lowerText.includes('residential')) {
          const platters = await platterService.getAllPlatters();
          const resPlatter = platters.find((p) => p.slug.includes('residential')) || platters[0];
          await sessionService.updateSession(chatId, {
            selectedPlatterId: resPlatter ? resPlatter.id : undefined,
            step: ChatStep.SELECT_PROJECT,
          });
          await this.sendProjectsList(client, chatId, resPlatter ? resPlatter.id : undefined, '🏡 RESIDENTIAL PROJECTS');
        } else if (rawText === '2' || lowerText.includes('commercial')) {
          const platters = await platterService.getAllPlatters();
          const commPlatter = platters.find((p) => p.slug.includes('commercial')) || platters[1] || platters[0];
          await sessionService.updateSession(chatId, {
            selectedPlatterId: commPlatter ? commPlatter.id : undefined,
            step: ChatStep.SELECT_PROJECT,
          });
          await this.sendProjectsList(client, chatId, commPlatter ? commPlatter.id : undefined, '🏢 COMMERCIAL PROJECTS');
        } else if (rawText === '3' || lowerText.includes('faq')) {
          await this.sendFaqMenu(client, chatId);
        } else if (rawText === '4' || lowerText.includes('partner') || lowerText.includes('change') || lowerText.includes('update')) {
          await this.sendChannelPartnerList(client, chatId);
        } else {
          await this.reply(
            client,
            chatId,
            `⚠️ Please reply with a valid option:\n` +
            `1️⃣ *Residential Projects*\n` +
            `2️⃣ *Commercial Projects*\n` +
            `3️⃣ *FAQs & Help Desk*`,
            session.step
          );
        }
        break;
      }

      // Step 7: Project Selection from Platter
      case ChatStep.SELECT_PROJECT: {
        if (rawText === '0' || lowerText === 'back') {
          await this.sendPlatterMenu(client, chatId, session.name || 'Partner');
          return;
        }

        const projects = await projectService.getAllProjects(session.selectedPlatterId || undefined);
        const choice = parseInt(rawText, 10);
        if (isNaN(choice) || choice < 1 || choice > projects.length) {
          await this.reply(
            client,
            chatId,
            `⚠️ Invalid selection. Please reply with a number between *1 and ${projects.length}* (or *0* to return to Platters):`,
            session.step
          );
          return;
        }

        const selectedProp = projects[choice - 1];
        await sessionService.updateSession(chatId, {
          selectedPropertyId: selectedProp.id,
          step: ChatStep.SELECT_COLLATERAL,
        });

        await this.sendCollateralMenu(client, chatId, selectedProp);
        break;
      }

      // Step 8: Deliver Selected Asset / Creative
      case ChatStep.SELECT_COLLATERAL: {
        const currentProp = await projectService.getProjectById(session.selectedPropertyId || '');
        if (!currentProp) {
          await this.sendPlatterMenu(client, chatId, session.name || 'Partner');
          return;
        }

        const activeCollaterals = await collateralService.getActiveCollateralsForProject(currentProp.id);
        const optChooseProj = activeCollaterals.length + 1;
        const optMainMenu = activeCollaterals.length + 2;
        const optFaqs = activeCollaterals.length + 3;
        const totalOptions = optFaqs;

        const choiceNum = parseInt(rawText.trim(), 10);

        if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > totalOptions) {
          await this.reply(
            client,
            chatId,
            `⚠️ Please reply with a valid number from 1 to ${totalOptions} to choose your collateral.`,
            session.step
          );
          await this.sendCollateralMenu(client, chatId, currentProp);
          break;
        }

        // Navigation 1: Choose another project
        if (choiceNum === optChooseProj) {
          await sessionService.updateSession(chatId, { step: ChatStep.SELECT_PROJECT });
          await this.sendProjectsList(client, chatId, session.selectedPlatterId || undefined, 'DEVELOPMENTS');
          break;
        }

        // Navigation 2: Return to main menu (Platters)
        if (choiceNum === optMainMenu) {
          await this.sendPlatterMenu(client, chatId, session.name || 'Partner');
          break;
        }

        // Navigation 3: FAQs for this project
        if (choiceNum === optFaqs) {
          await this.sendFaqMenu(client, chatId);
          break;
        }

        // Selected active collateral from database
        const selectedCollateral = activeCollaterals[choiceNum - 1];
        const code = (selectedCollateral.code || '').toUpperCase();

        if (code === 'BROCHURE') {
          // Deliver Personalized PDF Brochure
          await this.reply(
            client,
            chatId,
            `⏳ *Generating official personalized PDF brochure for ${session.name || 'Partner'} (${session.firmName || 'Channel Partner'})...*`,
            ChatStep.SELECT_COLLATERAL
          );

          try {
            if (!currentProp.brochurePath) {
              await this.reply(
                client,
                chatId,
                `⚠️ Brochure document for ${currentProp.name} is currently being updated. Please choose another collateral.`,
                ChatStep.SELECT_COLLATERAL
              );
              return;
            }

            const watermarkedPdf = await watermarkService.watermarkPdf(
              currentProp.brochurePath,
              session.name || 'Channel Partner',
              formatPhone(session.phone || realPhone),
              session.firmName || '',
              session.reraNumber || ''
            );

            const fileName = `${currentProp.name.replace(/[^a-zA-Z0-9]/g, '_')}_Brochure.pdf`;
            const media = new MessageMedia(
              'application/pdf',
              watermarkedPdf.toString('base64'),
              fileName
            );

            const pdfCaption =
              `📄 *Official Project Brochure: ${currentProp.name}*\n` +
              `👤 Partner: *${session.name || 'Channel Partner'}*\n` +
              `🏢 Firm: *${session.firmName || 'Realty Advisor'}*\n` +
              `📜 RERA: *${session.reraNumber || 'Verified'}*\n` +
              `📱 Mobile: *${formatPhone(session.phone || realPhone)}*`;

            await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
            await client.sendMessage(chatId, pdfCaption);
            await chatRecordService.recordOutgoingMessage(chatId, pdfCaption, ChatStep.SELECT_COLLATERAL, 'pdf');

            await this.sendConfirmationOptions(client, chatId, currentProp.name);
          } catch (err: any) {
            console.error('Error generating watermarked PDF:', err);
            await this.reply(client, chatId, `⚠️ Error creating brochure: ${err.message}`, ChatStep.SELECT_COLLATERAL);
          }
        } else if (code === 'GALLERY' || code === 'IMAGES') {
          // Deliver High-Res 3D Creatives & Gallery (Watermarked)
          await this.reply(
            client,
            chatId,
            `⏳ *Rendering watermarked architectural creatives with your firm branding...*`,
            ChatStep.SELECT_COLLATERAL
          );

          try {
            const images = currentProp.imagePaths;
            if (!images || images.length === 0) {
              await this.reply(
                client,
                chatId,
                `⚠️ Images for ${currentProp.name} are currently being updated in our media desk.`,
                ChatStep.SELECT_COLLATERAL
              );
              return;
            }

            for (let i = 0; i < Math.min(images.length, 3); i++) {
              const imgPath = images[i];
              const watermarkedImg = await watermarkService.watermarkImage(
                imgPath,
                session.name || 'Channel Partner',
                formatPhone(session.phone || realPhone),
                session.firmName || '',
                session.reraNumber || ''
              );

              const media = new MessageMedia(
                'image/jpeg',
                watermarkedImg.toString('base64'),
                `Creative_${i + 1}.jpg`
              );

              const imgCaption =
                `🖼️ *${currentProp.name} - Official Creative ${i + 1}*\n` +
                `👤 Partner: *${session.name}* | *${session.firmName || 'M3M Partner'}*\n` +
                `📜 RERA: *${session.reraNumber || 'Verified'}*`;

              await client.sendMessage(chatId, media, { caption: imgCaption });
              await chatRecordService.recordOutgoingMessage(chatId, imgCaption, ChatStep.SELECT_COLLATERAL, 'image');
            }

            await this.sendConfirmationOptions(client, chatId, currentProp.name);
          } catch (err: any) {
            console.error('Error watermarking image:', err);
            await this.reply(client, chatId, `⚠️ Error creating creatives: ${err.message}`, ChatStep.SELECT_COLLATERAL);
          }
        } else if (code === 'FACTSHEET') {
          // Deliver Factsheet & Specifications
          const factsheet =
            `📑 *PROJECT FACTSHEET: ${currentProp.name.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📍 *Location:* ${currentProp.location}\n` +
            `💰 *Price Range:* ${currentProp.priceRange}\n` +
            `📜 *RERA Reg No:* ${currentProp.reraNumber}\n\n` +
            `📝 *Project Overview:*\n${currentProp.description}\n\n` +
            `🌟 *Key Amenities & Highlights:*\n` +
            currentProp.amenities.map((a) => `• ${a}`).join('\n') +
            `\n\n💼 *Personalized for:* ${session.name} (${session.firmName || 'Partner'})\n` +
            `📞 *Mobile:* ${formatPhone(session.phone || realPhone)}`;

          await this.reply(client, chatId, factsheet, ChatStep.SELECT_COLLATERAL);
          await this.sendConfirmationOptions(client, chatId, currentProp.name);
        } else {
          // Deliver Custom Dynamic Collateral from database (Floor Plan, Payment Plan, Location Map, etc.)
          await this.deliverCustomCollateral(
            client,
            chatId,
            session,
            currentProp,
            selectedCollateral,
            realPhone
          );
        }
        break;
      }

      // Step 9: Collateral Confirmation Options
      case ChatStep.COLLATERAL_CONFIRMATION: {
        const choice = rawText.trim();
        const currentProp = await projectService.getProjectById(session.selectedPropertyId || '');

        if (choice === '1' && currentProp) {
          // Browse more creatives for this project
          await sessionService.updateSession(chatId, { step: ChatStep.SELECT_COLLATERAL });
          await this.sendCollateralMenu(client, chatId, currentProp);
        } else if (choice === '2') {
          // Choose another project
          await sessionService.updateSession(chatId, { step: ChatStep.SELECT_PROJECT });
          await this.sendProjectsList(client, chatId, session.selectedPlatterId || undefined, 'DEVELOPMENTS');
        } else if (choice === '3') {
          // Return to main menu (Platters)
          await this.sendPlatterMenu(client, chatId, session.name || 'Partner');
        } else if (choice === '4') {
          // View FAQs
          await this.sendFaqMenu(client, chatId);
        } else {
          await this.reply(
            client,
            chatId,
            `👉 Reply with *1* (More Creatives), *2* (Choose Project), *3* (Main Menu), or *4* (FAQs):`,
            session.step
          );
        }
        break;
      }

      // Dynamic FAQ Mode
      case ChatStep.FAQ_MODE: {
        if (rawText === '0' || lowerText === 'menu' || lowerText === 'back') {
          await this.sendPlatterMenu(client, chatId, session.name || 'Partner');
          return;
        }

        const faqs = await faqService.getFaqs();
        const numChoice = parseInt(rawText, 10);

        if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= faqs.length) {
          const selectedFaq = faqs[numChoice - 1];
          const faqReply =
            `📌 *Q: ${selectedFaq.question}*\n\n` +
            `${selectedFaq.answer}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👉 *Reply with another FAQ number (1 - ${faqs.length}), type a question, or reply 0 to return to Main Menu:*`;

          await this.reply(client, chatId, faqReply, ChatStep.FAQ_MODE);
          return;
        }

        // Try natural language / keyword match
        const match = await faqService.findBestMatch(rawText);
        if (match) {
          const faqReply =
            `📌 *Q: ${match.question}*\n\n` +
            `${match.answer}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👉 *Reply with an FAQ number, type another question, or reply 0 for Main Menu:*`;
          await this.reply(client, chatId, faqReply, ChatStep.FAQ_MODE);
          return;
        }

        // Default: display FAQ menu again
        await this.reply(
          client,
          chatId,
          `ℹ️ No exact answer found for "${rawText}". Here are the available FAQ topics:\n*(Or reply 0 to return to Main Menu)*`,
          ChatStep.FAQ_MODE
        );
        await this.sendFaqMenu(client, chatId);
        break;
      }

      default: {
        await sessionService.resetSession(chatId, realPhone);
        await this.sendInitialWelcome(client, chatId);
        break;
      }
    }
  }

  /**
   * Displays list of Admin-registered Channel Partners for user to select from.
   * Users can ONLY choose from admin-registered partners, cannot manually create.
   */
  public async sendChannelPartnerList(client: Client, to: string): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.CHOOSE_CHANNEL_PARTNER });

    const partners = await channelPartnerService.getAll();
    const activePartners = partners.filter((p) => p.status);

    let text =
      `👋 *WELCOME TO M3M NOIDA CHANNEL PARTNER PORTAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Generate high-converting, personalized marketing collaterals (Brochures, 3D Architectural Creatives, Floor Plans & Specifications) branded with your company name and RERA details.\n\n` +
      `🏢 *Please select your registered Channel Partner profile:*\n\n`;

    activePartners.forEach((cp, idx) => {
      const emoji = this.getNumberEmoji(idx);
      text += `${emoji} *${cp.firmName}*\n`;
      text += `   👤 ${cp.fullName} | 📜 RERA: *${cp.reraNumber}*\n\n`;
    });

    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👉 *Reply with a number (1 - ${activePartners.length}) to select your firm.*\n`;
    text += `*(Or reply with your firm's UP RERA Registration Number)*\n\n`;
    text += `ℹ️ *Note:* Channel Partner registrations are managed by M3M Admin only. To register your firm, please contact M3M Partner Desk at partners@m3m.com.`;

    await this.reply(client, to, text, ChatStep.CHOOSE_CHANNEL_PARTNER);
  }

  public async sendInitialWelcome(client: Client, to: string): Promise<void> {
    await this.sendChannelPartnerList(client, to);
  }

  /**
   * Step 6: Confirmation of Channel Partner Profile.
   */
  public async sendChannelPartnerVerified(
    client: Client,
    to: string,
    partnerName: string,
    firmName: string,
    reraNo: string,
    phone: string
  ): Promise<void> {
    const verifiedMsg =
      `✅ *CHANNEL PARTNER PROFILE VERIFIED*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Partner Name:* ${partnerName}\n` +
      `🏢 *Firm Name:* ${firmName}\n` +
      `📜 *RERA Reg No:* ${reraNo}\n` +
      `📱 *WhatsApp:* ${formatPhone(phone)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Your credentials will be dynamically embedded on all project collaterals & brochures.`;

    await this.reply(client, to, verifiedMsg, ChatStep.SELECT_PLATTER);
    await this.sendPlatterMenu(client, to, partnerName);
  }

  /**
   * Step 1: Platter / Category Menu (Residential Projects vs Commercial Projects).
   */
  public async sendPlatterMenu(client: Client, to: string, partnerName: string): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.SELECT_PLATTER });

    const menuMsg =
      `Dear *${partnerName}*, Welcome to ${process.env.PROJECT_NAME} Chatbot.\n\n` +
      `Please select a project category from the platter below:\n\n` +
      `1️⃣ 🏡 *Residential Projects* (Ultra-Luxury Sky Mansions & Studio Suites)\n` +
      `2️⃣ 🏢 *Commercial Projects* (High-Street Retail, Multiplex & Dining Promenades)\n` +
      `👉 *Reply with 1 or 2:*`;

    await this.reply(client, to, menuMsg, ChatStep.SELECT_PLATTER);
  }

  /**
   * Displays list of projects under the selected Platter.
   */
  public async sendProjectsList(
    client: Client,
    to: string,
    platterId?: string,
    titleHeader: string = 'DEVELOPMENTS'
  ): Promise<void> {
    const projects = await projectService.getAllProjects(platterId);

    if (projects.length === 0) {
      await this.reply(
        client,
        to,
        `⚠️ No active developments found in this category at the moment.\nReply *0* to return to Main Menu:`,
        ChatStep.SELECT_PROJECT
      );
      return;
    }

    let listText = `🏢 *M3M NOIDA - ${titleHeader}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    projects.forEach((prop, idx) => {
      listText += `*${idx + 1}️⃣ ${prop.name}*\n`;
      listText += `   📍 *Location:* ${prop.location}\n`;
      listText += `   💰 *Price:* ${prop.priceRange}\n`;
      listText += `   🌟 *Tagline:* ${prop.tagline}\n`;
      listText += `   📜 *RERA:* ${prop.reraNumber}\n\n`;
    });

    listText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    listText += `👉 *Reply with a project number (1 - ${projects.length}) to select collaterals:*\n`;
    listText += `*(Or reply 0 to return to Platters menu)*`;

    await this.reply(client, to, listText, ChatStep.SELECT_PROJECT);
  }

  /**
   * Delivers custom or extended marketing collaterals (e.g. Floor Plans, Payment Plan, Location Map, Custom Assets).
   */
  private async deliverCustomCollateral(
    client: Client,
    chatId: string,
    session: any,
    currentProp: BotProject,
    collateral: CollateralItem,
    realPhone: string
  ): Promise<void> {
    await this.reply(
      client,
      chatId,
      `⏳ *Preparing ${collateral.title} for ${session.name || 'Partner'}...*`,
      ChatStep.SELECT_COLLATERAL
    );

    try {
      let detailText = collateral.content;
      if (!detailText) {
        if (collateral.code === 'FLOOR_PLAN') {
          detailText =
            `📐 *ARCHITECTURAL LAYOUT & FLOOR PLANS: ${currentProp.name.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏢 *Project:* ${currentProp.name}\n` +
            `📍 *Location:* ${currentProp.location}\n` +
            `📜 *RERA Reg No:* ${currentProp.reraNumber}\n\n` +
            `• *Configurations:* 3 BHK, 4 BHK & 5 BHK Sky Mansions\n` +
            `• *Deck Space:* Wrap-around balconies with 360° open greens / skyline view\n` +
            `• *Ceiling Height:* 11.5 ft clear ceiling heights\n` +
            `• *Elevators:* High-speed private elevator access per apartment`;
        } else if (collateral.code === 'PAYMENT_PLAN') {
          detailText =
            `💰 *OFFICIAL PAYMENT PLAN & COMMERCIAL TERMS: ${currentProp.name.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏢 *Project:* ${currentProp.name}\n` +
            `💰 *Starting Range:* ${currentProp.priceRange}\n\n` +
            `1️⃣ *Construction Linked Plan (CLP):*\n` +
            `• 10% on Booking\n` +
            `• 15% within 45 Days\n` +
            `• Balance linked to milestone slab completion\n\n` +
            `2️⃣ *Flexi Possession-Linked (30:40:30):*\n` +
            `• 30% Initial booking & agreement\n` +
            `• 40% on Superstructure completion\n` +
            `• 30% on Offer of Possession`;
        } else if (collateral.code === 'LOCATION_MAP') {
          detailText =
            `🗺️ *STRATEGIC LOCATION & CONNECTIVITY: ${currentProp.name.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏢 *Project:* ${currentProp.name}\n` +
            `📍 *Address:* ${currentProp.location}\n\n` +
            `🚗 *Road Proximity:*\n` +
            `• 0-KM from South Delhi via Kalindi Kunj\n` +
            `• Directly fronting Noida-Greater Noida Expressway\n` +
            `• 15 mins to DND Flyway & Mahamaya Flyover\n\n` +
            `🚇 *Metro Proximity:*\n` +
            `• Walking distance to Magenta Line Metro Station\n` +
            `• Seamless connectivity to IGI Airport & Cyber City`;
        } else {
          detailText =
            `📑 *${collateral.title.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🏢 *Project:* ${currentProp.name}\n` +
            `📍 *Location:* ${currentProp.location}\n` +
            `📜 *RERA Reg No:* ${currentProp.reraNumber}\n\n` +
            `${collateral.subtitle ? `${collateral.subtitle}\n\n` : ''}` +
            `📝 *Project Overview:*\n${currentProp.description}`;
        }
      }

      const messageContent =
        `${detailText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💼 *Personalized for:* ${session.name || 'Channel Partner'} (${session.firmName || 'Realty Advisor'})\n` +
        `📜 *RERA:* ${session.reraNumber || 'Verified'}\n` +
        `📞 *Mobile:* ${formatPhone(session.phone || realPhone)}`;

      await this.reply(client, chatId, messageContent, ChatStep.SELECT_COLLATERAL);
      await this.sendConfirmationOptions(client, chatId, currentProp.name);
    } catch (err: any) {
      console.error('Error delivering custom collateral:', err);
      await this.reply(client, chatId, `⚠️ Error preparing collateral: ${err.message}`, ChatStep.SELECT_COLLATERAL);
    }
  }

  /**
   * Helper to format index into emoji numbers: 1️⃣, 2️⃣, ..., 🔟
   */
  private getNumberEmoji(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || `[${index + 1}]`;
  }

  /**
   * Step 7: Dynamic Collaterals selection menu from database for selected project.
   * Only displays collaterals where status === true (Active in database).
   */
  public async sendCollateralMenu(
    client: Client,
    to: string,
    prop: BotProject
  ): Promise<void> {
    const activeCollaterals = await collateralService.getActiveCollateralsForProject(prop.id);

    let collateralOptions = '';
    activeCollaterals.forEach((item, index) => {
      const emoji = this.getNumberEmoji(index);
      const icon = item.icon || '📄';
      const sub = item.subtitle ? ` ${item.subtitle}` : '';
      collateralOptions += `${emoji} ${icon} *${item.title}*${sub}\n`;
    });

    const optChooseProj = activeCollaterals.length + 1;
    const optMainMenu = activeCollaterals.length + 2;
    const optFaqs = activeCollaterals.length + 3;
    const totalOptions = optFaqs;

    const navOptions =
      `${this.getNumberEmoji(optChooseProj - 1)} 🔄 *Choose Another Project*\n` +
      `${this.getNumberEmoji(optMainMenu - 1)} 🏠 *Return to Main Menu (Platters)*\n` +
      `${this.getNumberEmoji(optFaqs - 1)} ❓ *FAQs for ${prop.name}*\n\n`;

    const menuText =
      `Please select your personalized marketing collaterals from the list below for *${prop.name}*:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Location:* ${prop.location} | 📜 *RERA:* ${prop.reraNumber}\n\n` +
      collateralOptions +
      navOptions +
      `👉 *Reply with a number (1 - ${totalOptions}):*`;

    await this.reply(client, to, menuText, ChatStep.SELECT_COLLATERAL);
  }

  /**
   * Step 9: Post-delivery options confirmation.
   */
  public async sendConfirmationOptions(
    client: Client,
    to: string,
    projectName: string
  ): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.COLLATERAL_CONFIRMATION });

    const confirmMsg =
      `✅ *Selected Marketing Collateral Delivered Successfully!*\n\n` +
      `👉 *What would you like to do next?*\n` +
      `1️⃣ 🎨 *Browse more creatives for ${projectName}*\n` +
      `2️⃣ 🏢 *Choose another project*\n` +
      `3️⃣ 🏠 *Return to main menu (Platters)*\n` +
      `4️⃣ ❓ *View FAQs*`;

    await this.reply(client, to, confirmMsg, ChatStep.COLLATERAL_CONFIRMATION);
  }

  /**
   * Dynamic FAQ Menu retrieved from database.
   */
  public async sendFaqMenu(client: Client, to: string): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.FAQ_MODE });

    const faqs = await faqService.getFaqs();

    let faqText = `❓ *M3M NOIDA - FREQUENTLY ASKED QUESTIONS (FAQ)*\n`;
    faqText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    faqs.forEach((faq, idx) => {
      faqText += `*${idx + 1}️⃣ ${faq.question}*\n`;
    });

    faqText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    faqText += `👉 *Reply with a question number (1 - ${faqs.length}) to view the answer.*\n`;
    faqText += `Or simply type your question in English/Hindi!\n`;
    faqText += `*(Reply 0 to return to Main Menu)*`;

    await this.reply(client, to, faqText, ChatStep.FAQ_MODE);
  }
}

export const botService = new BotService();
