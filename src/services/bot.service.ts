import fs from 'node:fs';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import type { Client, Message } from 'whatsapp-web.js';
import { sessionService } from './session.service.js';
import { watermarkService } from './watermark.service.js';
import { projectService } from './project.service.js';
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
   * Checks whether the user has an active session created within the last 24 hours
   * with complete channel partner details (name, firmName, reraNumber).
   */
  public isSessionActiveWithin24Hr(session: any): boolean {
    if (!session || !session.name || !session.firmName || !session.reraNumber) {
      return false;
    }
    const lastActiveTime = session.lastActive ? new Date(session.lastActive).getTime() : 0;
    const hoursDiff = (Date.now() - lastActiveTime) / (1000 * 60 * 60);
    return hoursDiff < 24;
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

    // Extract sender's name from WhatsApp (pushname / notifyName / contact name)
    let senderName = (session.name || '').trim();
    if (!senderName || senderName.toLowerCase() === 'partner') {
      try {
        const contact = await message.getContact();
        senderName = (contact?.pushname || contact?.name || contact?.shortName || (message as any)._data?.notifyName || '').trim();
      } catch {
        senderName = ((message as any)._data?.notifyName || '').trim();
      }
      if (senderName && senderName.toLowerCase() !== 'partner') {
        await sessionService.updateSession(chatId, { name: senderName });
      }
    }

    if (realPhone && (!session.phone || session.phone.length > 13 || session.phone !== realPhone)) {
      await sessionService.updateSession(chatId, { phone: realPhone });
    }

    // Persist incoming message to DB
    await chatRecordService.recordIncomingMessage(chatId, rawText, session.step);

    const lowerText = rawText.toLowerCase();

    // Global reset keywords
    if (['restart', 'reset'].includes(lowerText)) {
      await sessionService.resetSession(chatId, realPhone);
      await this.sendPlatterMenu(client, chatId, senderName);
      return;
    }

    // Direct FAQ trigger anytime
    if (lowerText === 'faq' || lowerText === 'faqs' || lowerText === 'help') {
      await this.sendFaqMenu(client, chatId);
      return;
    }

    // Main Menu trigger anytime
    if (lowerText === 'menu' || lowerText === 'main menu' || lowerText === 'start') {
      await this.sendPlatterMenu(client, chatId, senderName);
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
      await this.sendPlatterMenu(client, chatId, senderName);
      return;
    }

    // State Machine
    switch (session.step) {
      // 1. Platter Selection: First choose Residential or Commercial
      case ChatStep.SELECT_PLATTER: {
        const platters = await platterService.getAllPlatters();
        const choiceNum = parseInt(rawText.trim(), 10);
        let selectedPlatter: any = null;

        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= platters.length) {
          selectedPlatter = platters[choiceNum - 1];
        } else if (lowerText.includes('residential') || lowerText === '1') {
          selectedPlatter = platters.find((p) => p.slug.includes('residential')) || platters[0];
        } else if (lowerText.includes('commercial') || lowerText === '2') {
          selectedPlatter = platters.find((p) => p.slug.includes('commercial')) || platters[1] || platters[0];
        } else if (rawText === String(platters.length + 1) || lowerText.includes('faq')) {
          await this.sendFaqMenu(client, chatId);
          return;
        }

        if (!selectedPlatter) {
          await this.reply(
            client,
            chatId,
            `⚠️ Please reply with a valid platter number from *1 to ${platters.length}*:`,
            session.step
          );
          await this.sendPlatterMenu(client, chatId, senderName);
          return;
        }

        // Save chosen platter
        await sessionService.updateSession(chatId, {
          selectedPlatterId: selectedPlatter.id,
        });

        // 24-hr session verification rule:
        const hasValid24HrSession = this.isSessionActiveWithin24Hr(session);

        if (hasValid24HrSession) {
          // Returning user with active session under 24hr: directly show collateral list
          await sessionService.updateSession(chatId, {
            step: ChatStep.SELECT_COLLATERAL,
          });
          await this.sendPlatterCollateralMenu(client, chatId, selectedPlatter);
          return;
        }

        // First-time user OR session > 24hr: Prompt for full name
        await sessionService.updateSession(chatId, {
          step: ChatStep.AWAITING_NAME,
        });

        const welcomeMsg =
          `👋 Welcome to M3M Noida.\n\n\n` +
          `Your personalized marketing creatives are just a few taps away.\n` +
          `✅ Ready-to-use\n` +
          `✅ Co-branded with your name & number\n` +
          `✅ Perfect for WhatsApp, Instagram & more!\n\n\n` +
          `Let’s get started👇,\n` +
          `Please enter your full name`;

        await this.reply(client, chatId, welcomeMsg, ChatStep.AWAITING_NAME);
        break;
      }

      // 2. Full Name Input
      case ChatStep.AWAITING_NAME: {
        const name = rawText.trim();
        if (!name || name.length < 2) {
          await this.reply(client, chatId, `⚠️ Please enter a valid full name:`, ChatStep.AWAITING_NAME);
          return;
        }

        await sessionService.updateSession(chatId, {
          name,
          step: ChatStep.AWAITING_RERA,
        });

        await this.reply(
          client,
          chatId,
          `Please enter company's Rera No.`,
          ChatStep.AWAITING_RERA
        );
        break;
      }

      // 3. Company RERA Number Input
      case ChatStep.AWAITING_RERA: {
        const reraNo = rawText.trim().toUpperCase();
        if (!reraNo || reraNo.length < 3) {
          await this.reply(client, chatId, `⚠️ Please enter a valid company RERA No (e.g. UPRERAAGT10482):`, ChatStep.AWAITING_RERA);
          return;
        }

        await sessionService.updateSession(chatId, {
          reraNumber: reraNo,
          step: ChatStep.AWAITING_FIRM_NAME,
        });

        await this.reply(
          client,
          chatId,
          `Please Enter your company/Firm Name`,
          ChatStep.AWAITING_FIRM_NAME
        );
        break;
      }

      // 4. Company / Firm Name Input -> Show Channel Partner list from DB for user to choose
      case ChatStep.AWAITING_FIRM_NAME: {
        const firmName = rawText.trim();
        if (!firmName || firmName.length < 2) {
          await this.reply(client, chatId, `⚠️ Please enter a valid company or firm name:`, ChatStep.AWAITING_FIRM_NAME);
          return;
        }

        // Upsert channel partner in database
        const cleanPhone = (session.phone || realPhone || '').replace(/\D/g, '').slice(-10);
        let cp = cleanPhone.length >= 10 ? await channelPartnerService.findByPhone(cleanPhone) : null;
        if (!cp) {
          cp = await channelPartnerService.create({
            fullName: session.name || 'Partner',
            firmName,
            reraNumber: session.reraNumber || 'UPRERA-VERIFIED',
            mobileNo: cleanPhone || '9876543210',
            status: true,
          });
        } else {
          cp = await channelPartnerService.update(cp.id, {
            fullName: session.name,
            firmName,
            reraNumber: session.reraNumber,
          });
        }

        await sessionService.updateSession(chatId, {
          firmName,
          channelPartnerId: cp.id,
          step: ChatStep.CHOOSE_CHANNEL_PARTNER,
        });

        // Show channel partner list from DB
        const partners = await channelPartnerService.getAll();
        const activePartners = partners.filter((p) => p.status);

        let cpListText =
          `🏢 *REGISTERED CHANNEL PARTNERS (from DB)*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Please choose your Channel Partner profile from the list below:\n\n`;

        activePartners.forEach((p, idx) => {
          const emoji = this.getNumberEmoji(idx);
          const isCurrent = p.id === cp.id ? ' ⭐ *(Your Firm)*' : '';
          cpListText += `${emoji} *${p.firmName}*\n     👤 ${p.fullName} | 📜 ${p.reraNumber}${isCurrent}\n`;
        });

        cpListText +=
          `\n👉 *Reply with a number (1 to ${activePartners.length}) to select your Channel Partner:*`;

        await this.reply(client, chatId, cpListText, ChatStep.CHOOSE_CHANNEL_PARTNER);
        break;
      }

      // 5. Choose Channel Partner -> Then show Collateral List
      case ChatStep.CHOOSE_CHANNEL_PARTNER: {
        const partners = await channelPartnerService.getAll();
        const activePartners = partners.filter((p) => p.status);
        const choiceNum = parseInt(rawText.trim(), 10);

        let selectedPartner: any = null;
        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= activePartners.length) {
          selectedPartner = activePartners[choiceNum - 1];
        }

        if (!selectedPartner) {
          await this.reply(
            client,
            chatId,
            `⚠️ Please reply with a valid number from *1 to ${activePartners.length}* to select your Channel Partner:`,
            ChatStep.CHOOSE_CHANNEL_PARTNER
          );
          return;
        }

        // Link selected partner to session & advance to SELECT_COLLATERAL
        await sessionService.updateSession(chatId, {
          channelPartnerId: selectedPartner.id,
          name: selectedPartner.fullName,
          firmName: selectedPartner.firmName,
          reraNumber: selectedPartner.reraNumber,
          step: ChatStep.SELECT_COLLATERAL,
        });

        const selectedMsg =
          `✅ *Channel Partner Profile Selected*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Partner Name:* ${selectedPartner.fullName}\n` +
          `🏢 *Firm Name:* ${selectedPartner.firmName}\n` +
          `📜 *RERA Reg No:* ${selectedPartner.reraNumber}\n` +
          `📱 *Mobile:* ${formatPhone(session.phone || realPhone)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        await this.reply(client, chatId, selectedMsg, ChatStep.SELECT_COLLATERAL);

        // Immediately show collateral list for the chosen platter
        const platter = await platterService.getPlatterById(session.selectedPlatterId || '');
        if (platter) {
          await this.sendPlatterCollateralMenu(client, chatId, platter);
        } else {
          const platters = await platterService.getAllPlatters();
          await this.sendPlatterCollateralMenu(client, chatId, platters[0]);
        }
        break;
      }

      // Deliver Selected Collateral for Platter (No project list, background generation)
      case ChatStep.SELECT_COLLATERAL:
      case ChatStep.SELECT_PROJECT: {
        const platter = await platterService.getPlatterById(session.selectedPlatterId || '');
        if (!platter) {
          await this.sendPlatterMenu(client, chatId, senderName);
          return;
        }

        const activeCollaterals = await collateralService.getActiveCollateralsForPlatter(platter.id);
        const optMainMenu = activeCollaterals.length + 1;
        const optFaqs = activeCollaterals.length + 2;
        const totalOptions = optFaqs;

        const choiceNum = parseInt(rawText.trim(), 10);

        if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > totalOptions) {
          if (rawText === '0' || lowerText === 'back' || lowerText === 'menu') {
            await this.sendPlatterMenu(client, chatId, senderName);
            break;
          }
          await this.reply(
            client,
            chatId,
            `⚠️ Please reply with a valid number from 1 to ${totalOptions} to choose your collateral.`,
            session.step
          );
          await this.sendPlatterCollateralMenu(client, chatId, platter);
          break;
        }

        // Navigation 1: Return to main menu (Platters)
        if (choiceNum === optMainMenu || rawText === '0' || lowerText === 'menu' || lowerText === 'back') {
          await this.sendPlatterMenu(client, chatId, senderName);
          break;
        }

        // Navigation 2: FAQs
        if (choiceNum === optFaqs) {
          await this.sendFaqMenu(client, chatId);
          break;
        }

        // Deliver selected collateral directly in background (no "rendering" status message)
        const selectedCollateral = activeCollaterals[choiceNum - 1];
        await this.deliverCollateral(client, chatId, session, platter, selectedCollateral, realPhone);
        break;
      }

      // Collateral Confirmation Options
      case ChatStep.COLLATERAL_CONFIRMATION: {
        const choice = rawText.trim();
        const platter = await platterService.getPlatterById(session.selectedPlatterId || '');

        if (choice === '1' && platter) {
          // Choose another collateral
          await sessionService.updateSession(chatId, { step: ChatStep.SELECT_COLLATERAL });
          await this.sendPlatterCollateralMenu(client, chatId, platter);
        } else if (choice === '2') {
          // Return to main menu (Platters)
          await this.sendPlatterMenu(client, chatId, senderName);
        } else if (choice === '3') {
          // View FAQs
          await this.sendFaqMenu(client, chatId);
        } else {
          await this.reply(
            client,
            chatId,
            `👉 Reply with *1* (Choose Another Collateral), *2* (Main Menu - Platters), or *3* (FAQs):`,
            session.step
          );
        }
        break;
      }

      // Dynamic FAQ Mode
      case ChatStep.FAQ_MODE: {
        if (rawText === '0' || lowerText === 'menu' || lowerText === 'back') {
          await this.sendPlatterMenu(client, chatId, senderName);
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
        await this.sendPlatterMenu(client, chatId, senderName);
        break;
      }
    }
  }

  /**
   * Displays Platter / Category Menu.
   */
  public async sendPlatterMenu(client: Client, to: string, partnerName?: string): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.SELECT_PLATTER });

    const platters = await platterService.getAllPlatters();

    let platterOptions = '';
    platters.forEach((p, idx) => {
      const emoji = this.getNumberEmoji(idx);
      const icon = p.slug.includes('residential') ? '🏡' : p.slug.includes('commercial') ? '🏢' : '🌟';
      platterOptions += `${emoji} ${icon} *${p.name}* ${p.tagline ? `(${p.tagline})` : ''}\n`;
    });

    const optFaqs = platters.length + 1;

    const cleanName = (partnerName || '').trim();
    const hasValidName = cleanName && cleanName.toLowerCase() !== 'partner';

    const greetingLine = hasValidName
      ? `Dear *${cleanName}*,\n\nWelcome to ${process.env.PROJECT_NAME || 'M3M Noida'} Chatbot.\n\n`
      : `Welcome to ${process.env.PROJECT_NAME || 'M3M Noida'} Chatbot.\n\n`;

    const menuMsg =
      greetingLine +
      `Please select a project category from the platter below:\n\n` +
      platterOptions +
      `\n${this.getNumberEmoji(optFaqs - 1)} ❓ *FAQs & Help Desk*\n\n` +
      `👉 *Reply with a number (1 - ${optFaqs}):*`;

    await this.reply(client, to, menuMsg, ChatStep.SELECT_PLATTER);
  }

  /**
   * Displays list of collaterals for selected Platter.
   */
  public async sendPlatterCollateralMenu(
    client: Client,
    to: string,
    platter: any
  ): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.SELECT_COLLATERAL });

    const activeCollaterals = await collateralService.getActiveCollateralsForPlatter(platter.id);

    let collateralOptions = '';
    activeCollaterals.forEach((item, index) => {
      const emoji = this.getNumberEmoji(index);
      const icon = item.icon || '📄';
      const sub = item.subtitle ? ` ${item.subtitle}` : '';
      collateralOptions += `${emoji} ${icon} *${item.title}*${sub}\n`;
    });

    const optMainMenu = activeCollaterals.length + 1;
    const optFaqs = activeCollaterals.length + 2;
    const totalOptions = optFaqs;

    const navOptions =
      `\n${this.getNumberEmoji(optMainMenu - 1)} 🏠 *Return to Main Menu (Platters)*\n` +
      `${this.getNumberEmoji(optFaqs - 1)} ❓ *FAQs & Help Desk*\n\n`;

    const menuText =
      `Please select your personalized marketing collaterals from the list below for *${platter.name}*:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      collateralOptions +
      navOptions +
      `👉 *Reply with a number (1 - ${totalOptions}):*`;

    await this.reply(client, to, menuText, ChatStep.SELECT_COLLATERAL);
  }

  /**
   * Delivers the selected collateral in background without rendering messages.
   * WhatsApp EDM outputs the project details matching the chosen platter.
   */
  private async deliverCollateral(
    client: Client,
    chatId: string,
    session: any,
    platter: any,
    collateral: CollateralItem,
    realPhone: string
  ): Promise<void> {
    const userName = session.name || session.firmName || 'Channel Partner';
    const userMobile = formatPhone(session.phone || realPhone);
    const code = (collateral.code || '').toUpperCase();
    const isResidential =
      (platter.slug || '').toLowerCase().includes('residential') ||
      (platter.name || '').toLowerCase().includes('residential');

    // 1. STORY (Personalized) - Dynamically generates luxury 9:16 vertical festive flyer
    if (code === 'STORY' || code === 'WHATSAPP_STORY') {
      try {
        const flyerBuffer = await watermarkService.generatePersonalizedFlyer(
          platter.slug,
          userName,
          userMobile
        );

        const fileName = `${platter.name.replace(/[^a-zA-Z0-9]/g, '_')}_Festive_Story.jpg`;
        const media = new MessageMedia(
          'image/jpeg',
          flyerBuffer.toString('base64'),
          fileName
        );

        const caption =
          `📱 *${collateral.title}*\n` +
          `✨ *${isResidential ? 'M3M The Cullinan, Sector 94' : 'M3M The Line, Sector 72'}*\n` +
          `📞 *To know more, call ${userName}: ${userMobile}*`;

        await client.sendMessage(chatId, media, { caption });
        await chatRecordService.recordOutgoingMessage(chatId, caption, ChatStep.SELECT_COLLATERAL, 'image');
      } catch (err: any) {
        console.error('Error generating story flyer:', err);
        // Fallback to watermarking existing file
        try {
          const imageToWatermark = collateral.fileUrl || collateralService.getDefaultFileForPlatter(platter.slug, 'STORY');
          const resolvedPath = projectService.resolvePath(imageToWatermark);
          if (resolvedPath && fs.existsSync(resolvedPath)) {
            const watermarkedImg = await watermarkService.watermarkImage(resolvedPath, userName, userMobile);
            const media = new MessageMedia('image/jpeg', watermarkedImg.toString('base64'), 'Story.jpg');
            const caption = `📱 *${collateral.title}*\n📞 *To know more, call ${userName}: ${userMobile}*`;
            await client.sendMessage(chatId, media, { caption });
            await chatRecordService.recordOutgoingMessage(chatId, caption, ChatStep.SELECT_COLLATERAL, 'image');
          }
        } catch {
          await this.reply(
            client,
            chatId,
            `📱 *${collateral.title}*\n\n` +
            `Personalized creative ready for *${userName}*.\n` +
            `📞 *To know more, call:* ${userMobile}`,
            ChatStep.SELECT_COLLATERAL
          );
        }
      }
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // 2. EDM (Personalized) - Delivers project details relating to the chosen platter + dynamic luxury flyer
    if (code === 'EDM' || code === 'WHATSAPP_EDM') {
      let edmText = '';

      if (isResidential) {
        edmText =
          `💎 Invest in Noida’s Most Iconic Ultra-Luxury Sky Mansions this Navratri\n\n\n` +
          `✨ M3M The Cullinan, Sector 94, Noida Expressway\n\n\n` +
          `Payment Plan: 40:60\n` +
          `Starting from ₹5.75 Cr*\n\n\n\n\n` +
          `3, 4 & 5 BHK Ultra-Luxury Sky Residences\n` +
          `1,00,000 sq.ft Clubhouse & Sky Lounge\n` +
          `7 Swimming Pools & Private High-Speed Elevators\n` +
          `Panoramic River & Delhi Skyline Views\n` +
          `0-KM from South Delhi via Kalindi Kunj\n` +
          `Directly on Noida–Greater Noida Expressway\n\n\n` +
          `✨ A landmark designed not just for living, but for an ultra-luxury lifestyle statement.\n\n\n` +
          `📑 UP RERA: UPRERAPRJ442214\n` +
          `Price, inventory & offers subject to availability\n\n\n` +
          `Regards,\n` +
          `${userName} : ${userMobile}`;
      } else {
        edmText =
          `💎 Invest in Noida’s Next Luxury High Street this Navratri\n\n\n` +
          `✨ M3M Jewel Crest Avenue, Sector 97, Noida\n\n\n` +
          `Payment Plan: 40:60\n` +
          `Starting from ₹85 Lacs*\n\n\n\n\n` +
          `Food Court | Fine Dining | Lifestyle Retail | Entertainment Zone\n` +
          `~6 Acres of Luxury Retail Destination\n` +
          `Three-Side Open | Atrium-Led Design\n` +
          `Premium Retail & Lifestyle Destination\n` +
          `Entertainment & Experiential Zones\n` +
          `Multi-Level Parking\n` +
          `Directly on Noida–Greater Noida Expressway\n\n\n` +
          `✨ A destination designed not just for businesses, but for brands that want to be seen.\n\n\n` +
          `📑 UP RERA: UPRERAPRJ690055/10/2025\n` +
          `Price, inventory & offers subject to availability\n\n\n` +
          `Regards,\n` +
          `${userName} : ${userMobile}`;
      }

      // Deliver personalized dynamic luxury flyer with EDM caption
      try {
        const flyerBuffer = await watermarkService.generatePersonalizedFlyer(
          platter.slug,
          userName,
          userMobile
        );

        const media = new MessageMedia(
          'image/jpeg',
          flyerBuffer.toString('base64'),
          `${platter.name.replace(/[^a-zA-Z0-9]/g, '_')}_EDM.jpg`
        );

        await client.sendMessage(chatId, media, { caption: edmText });
        await chatRecordService.recordOutgoingMessage(chatId, edmText, ChatStep.SELECT_COLLATERAL, 'image');
        await this.sendConfirmationOptions(client, chatId, platter.name);
        return;
      } catch (err: any) {
        console.error('Error generating EDM flyer:', err);
      }

      await this.reply(client, chatId, edmText, ChatStep.SELECT_COLLATERAL);
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // 3. VIDEO (Personalized)
    if (code === 'VIDEO' || code === 'WHATSAPP_VIDEO') {
      const videoPath = collateral.fileUrl ? projectService.resolvePath(collateral.fileUrl) : null;
      if (videoPath && fs.existsSync(videoPath)) {
        try {
          const media = MessageMedia.fromFilePath(videoPath);
          const caption =
            `🎥 *${collateral.title}*\n` +
            `📞 *To know more, call ${userName}: ${userMobile}*`;
          await client.sendMessage(chatId, media, { caption });
          await chatRecordService.recordOutgoingMessage(chatId, caption, ChatStep.SELECT_COLLATERAL, 'video');
          await this.sendConfirmationOptions(client, chatId, platter.name);
          return;
        } catch (err: any) {
          console.error('Error sending video:', err);
        }
      }

      const videoMsg =
        `🎥 *${collateral.title}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Official promotional video walkthrough personalized with your details:\n\n` +
        `👤 *Channel Partner:* ${userName}\n` +
        `📞 *To know more, call:* ${userMobile}\n\n` +
        `${collateral.content || 'Video walkthrough media available in Partner Media Desk.'}`;

      await this.reply(client, chatId, videoMsg, ChatStep.SELECT_COLLATERAL);
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // 4. BROCHURE
    if (code === 'BROCHURE') {
      try {
        let brochurePath = collateral.fileUrl || collateralService.getDefaultFileForPlatter(platter.slug, 'BROCHURE');
        if (!brochurePath) {
          const projects = await projectService.getAllProjects(platter.id);
          const projWithBrochure = projects.find((p) => p.brochurePath);
          if (projWithBrochure) brochurePath = projWithBrochure.brochurePath;
        }

        const resolvedBrochure = projectService.resolvePath(brochurePath);

        if (resolvedBrochure && fs.existsSync(resolvedBrochure)) {
          const watermarkedPdf = await watermarkService.watermarkPdf(
            resolvedBrochure,
            userName,
            userMobile,
            session.firmName || '',
            session.reraNumber || ''
          );

          const fileName = `${platter.name.replace(/[^a-zA-Z0-9]/g, '_')}_Brochure.pdf`;
          const media = new MessageMedia(
            'application/pdf',
            watermarkedPdf.toString('base64'),
            fileName
          );

          const pdfCaption =
            `📄 *Official Project Brochure: ${platter.name}*\n` +
            `📞 *To know more, call ${userName}: ${userMobile}*`;

          await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
          await client.sendMessage(chatId, pdfCaption);
          await chatRecordService.recordOutgoingMessage(chatId, pdfCaption, ChatStep.SELECT_COLLATERAL, 'pdf');
        } else {
          await this.reply(
            client,
            chatId,
            `📄 *${collateral.title}*\n\nBrochure document is being updated by the administration team for ${platter.name}.`,
            ChatStep.SELECT_COLLATERAL
          );
        }
      } catch (err: any) {
        console.error('Error generating brochure:', err);
        await this.reply(client, chatId, `⚠️ Error creating brochure: ${err.message}`, ChatStep.SELECT_COLLATERAL);
      }
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // 5. FLOOR_PLANS
    if (code === 'FLOOR_PLANS' || code === 'FLOOR_PLAN') {
      try {
        const planPath = collateral.fileUrl || collateralService.getDefaultFileForPlatter(platter.slug, 'FLOOR_PLANS');
        const resolvedPlan = projectService.resolvePath(planPath);

        if (resolvedPlan && fs.existsSync(resolvedPlan)) {
          const watermarkedImg = await watermarkService.watermarkImage(
            resolvedPlan,
            userName,
            userMobile,
            session.firmName || '',
            session.reraNumber || ''
          );

          const media = new MessageMedia(
            'image/jpeg',
            watermarkedImg.toString('base64'),
            `${platter.name.replace(/[^a-zA-Z0-9]/g, '_')}_Floor_Plan.jpg`
          );

          const caption =
            `📐 *${collateral.title} - ${platter.name}*\n` +
            `🏢 *Category:* ${platter.name}\n` +
            `📞 *To know more, call ${userName}: ${userMobile}*`;

          await client.sendMessage(chatId, media, { caption });
          await chatRecordService.recordOutgoingMessage(chatId, caption, ChatStep.SELECT_COLLATERAL, 'image');
          await this.sendConfirmationOptions(client, chatId, platter.name);
          return;
        }
      } catch (err: any) {
        console.error('Error delivering floor plan:', err);
      }

      const planMsg =
        `📐 *OFFICIAL MASTER LAYOUT & FLOOR PLANS*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 *Category:* ${platter.name}\n` +
        `📍 *Location:* Prime Noida Expressway & Central Noida\n\n` +
        `${collateral.content || '• High-Street Open Retail Layouts & Atrium-Led Architecture\n• Anchor Stores, Hypermarkets & Experiential Zones\n• Flexible unit configurations with grand ceiling heights.'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *To know more, call:* ${userName} (${userMobile})`;

      await this.reply(client, chatId, planMsg, ChatStep.SELECT_COLLATERAL);
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // 6. OPP_DOC
    if (code === 'OPP_DOC') {
      try {
        const oppPath = collateral.fileUrl || collateralService.getDefaultFileForPlatter(platter.slug, 'OPP_DOC');
        const resolvedOpp = projectService.resolvePath(oppPath);

        if (resolvedOpp && fs.existsSync(resolvedOpp)) {
          const watermarkedPdf = await watermarkService.watermarkPdf(
            resolvedOpp,
            userName,
            userMobile,
            session.firmName || '',
            session.reraNumber || ''
          );

          const fileName = `${platter.name.replace(/[^a-zA-Z0-9]/g, '_')}_Opportunity_Doc.pdf`;
          const media = new MessageMedia(
            'application/pdf',
            watermarkedPdf.toString('base64'),
            fileName
          );

          const caption =
            `📑 *${collateral.title} - ${platter.name}*\n` +
            `📞 *To know more, call ${userName}: ${userMobile}*`;

          await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
          await client.sendMessage(chatId, caption);
          await chatRecordService.recordOutgoingMessage(chatId, caption, ChatStep.SELECT_COLLATERAL, 'document');
          await this.sendConfirmationOptions(client, chatId, platter.name);
          return;
        }
      } catch (err: any) {
        console.error('Error delivering opp doc:', err);
      }

      const oppMsg =
        `📑 *EXCLUSIVE INVESTMENT OPPORTUNITY DOCUMENT (OPP DOC)*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏢 *Category:* ${platter.name}\n\n` +
        `${collateral.content || '✨ High-growth commercial and luxury residential investment portfolios.\n💰 Flexible 40:60 payment plans, high rental yields, and attractive lease guarantee options.'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📞 *To know more, call:* ${userName} (${userMobile})`;

      await this.reply(client, chatId, oppMsg, ChatStep.SELECT_COLLATERAL);
      await this.sendConfirmationOptions(client, chatId, platter.name);
      return;
    }

    // Default / Custom Collateral
    const customContent = collateral.content || `${collateral.title} for ${platter.name}`;
    const customMsg =
      `📑 *${collateral.title.toUpperCase()}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${customContent}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💼 *Personalized for:* ${userName} (${session.firmName || 'Realty Advisor'})\n` +
      `📜 *RERA:* ${session.reraNumber || 'Verified'}\n` +
      `📞 *Mobile:* ${userMobile}`;

    await this.reply(client, chatId, customMsg, ChatStep.SELECT_COLLATERAL);
    await this.sendConfirmationOptions(client, chatId, platter.name);
  }

  /**
   * Post-delivery confirmation options.
   */
  public async sendConfirmationOptions(
    client: Client,
    to: string,
    categoryName: string
  ): Promise<void> {
    await sessionService.updateSession(to, { step: ChatStep.COLLATERAL_CONFIRMATION });

    const confirmMsg =
      `✅ *Selected Marketing Collateral Delivered Successfully!*\n\n` +
      `👉 *What would you like to do next?*\n` +
      `1️⃣ 🎨 *Choose another collateral for ${categoryName}*\n` +
      `2️⃣ 🏠 *Return to main menu (Platters)*\n` +
      `3️⃣ ❓ *View FAQs*`;

    await this.reply(client, to, confirmMsg, ChatStep.COLLATERAL_CONFIRMATION);
  }

  /**
   * Helper to format index into emoji numbers: 1️⃣, 2️⃣, ..., 🔟
   */
  private getNumberEmoji(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || `[${index + 1}]`;
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
