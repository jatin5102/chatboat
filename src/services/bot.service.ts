import fs from "node:fs";
import pkg from "whatsapp-web.js";
const { MessageMedia } = pkg;
import type { Client, Message } from "whatsapp-web.js";
import { sessionService } from "./session.service.js";
import { watermarkService } from "./watermark.service.js";
import { projectService } from "./project.service.js";
import { platterService } from "./platter.service.js";
import { channelPartnerService } from "./channelPartner.service.js";
import { faqService } from "./faq.service.js";
import { collateralService, CollateralItem } from "./collateral.service.js";
import { chatRecordService } from "./chatRecord.service.js";
import { ChatStep } from "../types/index.js";
import { prisma } from "../config/prisma.config.js";

function formatPhone(phone: string): string {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
        return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length >= 11 && digits.startsWith("44")) {
        return `+44 ${digits.slice(2)}`;
    }
    if (digits.length >= 12 && digits.startsWith("971")) {
        return `+971 ${digits.slice(3)}`;
    }
    return `+${digits}`;
}

/**
 * Resolves the user's actual phone number.
 */
export async function resolveRealPhoneNumber(client: Client, message: Message): Promise<string> {
    const from = message.from;

    // 1. If message.from already ends with @c.us, it is directly the real phone number
    if (from && from.endsWith("@c.us")) {
        const rawNum = from.replace("@c.us", "").replace(/\D/g, "");
        if (rawNum.length >= 10 && rawNum.length <= 13) {
            return rawNum;
        }
    }

    // 2. Query WhatsApp Web's internal LID-to-Phone resolver via client
    try {
        if (typeof (client as any).getContactLidAndPhone === "function") {
            const res = await (client as any).getContactLidAndPhone(from);
            if (Array.isArray(res) && res.length > 0 && res[0]?.pn) {
                const pnDigits = res[0].pn.replace(/@.*$/, "").replace(/\D/g, "");
                if (pnDigits.length >= 10 && pnDigits.length <= 13) {
                    return pnDigits;
                }
            }
        }
    } catch (err) {
        console.warn("[Phone Resolver] getContactLidAndPhone error:", err);
    }

    // 3. Query Contact model
    try {
        const contact = await message.getContact();
        if (contact) {
            if (contact.number && /^\d{10,13}$/.test(contact.number)) {
                return contact.number;
            }
            if (contact.id?.server === "c.us" && /^\d{10,13}$/.test(contact.id.user)) {
                return contact.id.user;
            }
            if (typeof contact.getFormattedNumber === "function") {
                const formatted = await contact.getFormattedNumber();
                const digits = formatted.replace(/\D/g, "");
                if (digits.length >= 10 && digits.length <= 13) {
                    return digits;
                }
            }
        }
    } catch (err) {
        console.warn("[Phone Resolver] getContact error:", err);
    }

    // 4. Fallback: inspect raw message _data
    const msgData = (message as any)._data;
    if (msgData) {
        const candidates = [msgData.id?.participant, msgData.author, msgData.from, msgData.to];
        for (const c of candidates) {
            if (typeof c === "string" && c.endsWith("@c.us")) {
                const d = c.replace("@c.us", "").replace(/\D/g, "");
                if (d.length >= 10 && d.length <= 13) {
                    return d;
                }
            }
        }
    }

    // 5. Ultimate fallback: remove @... suffix
    return from.replace(/@.*$/, "").replace(/\D/g, "");
}

export class BotService {
    private readyTimestamp: number = Math.floor(Date.now() / 1000);

    public setReadyTimestamp(ts: number = Math.floor(Date.now() / 1000)): void {
        this.readyTimestamp = ts;
    }

    /**
     * Validates whether a given string is a genuine user name (not a symbol, handle, or placeholder).
     */
    public isValidName(name?: string | null): boolean {
        if (!name) return false;
        const trimmed = name.trim();
        if (trimmed.length < 2) return false;
        const lower = trimmed.toLowerCase();
        if (
            ["partner", "channel partner", "user", "guest", "admin", "test", "unknown"].includes(
                lower,
            )
        ) {
            return false;
        }
        // Must contain at least two letters (not just symbols/punctuation like "@", "...", etc.)
        const letters = trimmed.replace(/[^a-zA-Z\u0600-\u06FF\u0900-\u097F]/g, "");
        return letters.length >= 2;
    }

    /**
     * Checks whether the user has an active session created within the last 24 hours.
     */
    public isSessionActiveWithin24Hr(session: any): boolean {
        if (!session || !session.lastActive) {
            return false;
        }
        const lastActiveTime = new Date(session.lastActive).getTime();
        if (isNaN(lastActiveTime) || lastActiveTime === 0) return false;
        const hoursDiff = (Date.now() - lastActiveTime) / (1000 * 60 * 60);
        return hoursDiff < 24;
    }

    /**
     * Helper to send an outgoing WhatsApp message and log it in the database.
     */
    public async reply(client: Client, to: string, text: string, step: string): Promise<void> {
        // Attempt 1: Direct sendMessage to recipient JID
        try {
            await client.sendMessage(to, text);
            await chatRecordService.recordOutgoingMessage(to, text, step, "text");
            return;
        } catch (err: any) {
            console.warn(
                `[Bot] Direct sendMessage to ${to} failed: ${err.message}. Trying fallbacks...`,
            );
        }

        // Attempt 2: Send via Chat instance
        try {
            const chat = await client.getChatById(to);
            if (chat) {
                await chat.sendMessage(text);
                await chatRecordService.recordOutgoingMessage(to, text, step, "text");
                return;
            }
        } catch (e: any) {
            console.warn(`[Bot] Chat instance sendMessage to ${to} failed: ${e.message}`);
        }

        // Attempt 3: Check resolved phone number from session
        try {
            const session = await sessionService.getSession(to).catch(() => null);
            const cleanPhone = (session?.phone || "").replace(/\D/g, "").slice(-10);
            if (cleanPhone.length === 10) {
                await client.sendMessage(`91${cleanPhone}@c.us`, text);
                await chatRecordService.recordOutgoingMessage(to, text, step, "text");
                return;
            }
        } catch (e: any) {
            console.warn(`[Bot] Phone fallback to 91${to} failed: ${e.message}`);
        }

        // Attempt 4: If 'to' contains direct digits
        try {
            const digits = to.replace(/@.*$/, "").replace(/\D/g, "");
            if (digits.length >= 10 && digits.length <= 13) {
                await client.sendMessage(`${digits}@c.us`, text);
                await chatRecordService.recordOutgoingMessage(to, text, step, "text");
                return;
            }
        } catch (e: any) {
            console.error(`[Bot] All delivery attempts failed for ${to}:`, e.message);
        }
    }

    public async handleMessage(client: Client, message: Message): Promise<void> {
        // 1. Ignore messages sent by own WhatsApp account
        if (message.fromMe) {
            return;
        }

        // 2. Ignore group messages, status updates, or broadcast messages
        if (
            message.from.endsWith("@g.us") ||
            message.isStatus ||
            message.from === "status@broadcast" ||
            (message as any).broadcast
        ) {
            return;
        }

        // 3. Ignore system / non-chat event messages (e2e notices, reactions, calls)
        if (
            ["e2e_notification", "notification_template", "call_log", "reaction", "gp2"].includes(
                message.type,
            )
        ) {
            return;
        }

        // 4. Ignore old historical backlog messages (older than 10 minutes / 600s from offline sync)
        const nowSec = Math.floor(Date.now() / 1000);
        if (message.timestamp && nowSec - message.timestamp > 600) {
            console.log(
                `[Bot] Ignored old message from ${message.from} (sent ${nowSec - message.timestamp}s ago)`,
            );
            return;
        }

        const rawText = (message.body || "").trim();
        const chatId = message.from;
        const realPhone = await resolveRealPhoneNumber(client, message);
        const session = await sessionService.getSession(chatId, realPhone);

        // Extract sender's real WhatsApp name
        const msgAny = message as any;
        let waName = (
            msgAny.pushname ||
            msgAny._data?.notifyName ||
            msgAny.notifyName ||
            ""
        ).trim();

        if (!waName) {
            try {
                const contact = await message.getContact();
                waName = (contact?.pushname || contact?.name || contact?.shortName || "").trim();
            } catch {}
        }

        if (!waName) {
            try {
                const contact = await client.getContactById(chatId);
                waName = (contact?.pushname || contact?.name || "").trim();
            } catch {}
        }

        // Check if phone matches a registered user in DB
        let senderName = this.isValidName(waName) ? waName : "";
        const cleanPhone = (realPhone || session.phone || "").replace(/\D/g, "").slice(-10);
        if (!senderName && cleanPhone.length >= 10) {
            const cp = await channelPartnerService.findByPhone(cleanPhone);
            if (cp?.fullName && this.isValidName(cp.fullName)) {
                senderName = cp.fullName.trim();
            }
        }

        if (!senderName && this.isValidName(session.name)) {
            senderName = session.name!.trim();
        }

        // Immediately keep in-memory session.name and DB synchronized with valid name
        if (this.isValidName(senderName) && session.name !== senderName) {
            session.name = senderName;
            await sessionService.updateSession(chatId, { name: senderName });
        }

        if (
            realPhone &&
            (!session.phone || session.phone.length > 13 || session.phone !== realPhone)
        ) {
            session.phone = realPhone;
            await sessionService.updateSession(chatId, { phone: realPhone });
        }

        // Persist incoming message to DB
        await chatRecordService.recordIncomingMessage(chatId, rawText, session.step);

        const lowerText = rawText.toLowerCase();

        // Global reset keywords
        if (["restart", "reset"].includes(lowerText)) {
            await sessionService.resetSession(chatId, realPhone);
            await this.sendPlatterMenu(client, chatId, senderName);
            return;
        }

        // Direct FAQ trigger anytime
        // if (lowerText === 'faq' || lowerText === 'faqs' || lowerText === 'help') {
        //   await this.sendFaqMenu(client, chatId);
        //   return;
        // }

        // Main Menu trigger anytime
        if (lowerText === "menu" || lowerText === "main menu" || lowerText === "start") {
            await this.sendPlatterMenu(client, chatId, senderName);
            return;
        }

        // Common greeting words
        const greetingWords = [
            "hi",
            "hello",
            "hey",
            "namaste",
            "hola",
            "good morning",
            "good afternoon",
            "good evening",
            "info",
            "start",
        ];
        const isGreeting =
            greetingWords.includes(lowerText) ||
            lowerText === "hi" ||
            lowerText.startsWith("hi ") ||
            lowerText.startsWith("hello ") ||
            lowerText.startsWith("hey ");

        // 5. When user sends greeting OR is at INITIAL step OR session has expired (> 24 hr):
        const isSessionExpired =
            session.step !== ChatStep.INITIAL && !this.isSessionActiveWithin24Hr(session);

        if (isGreeting || session.step === ChatStep.INITIAL || isSessionExpired) {
            if (isSessionExpired) {
                await sessionService.resetSession(chatId, realPhone);
            }
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
                } else if (lowerText.includes("residential") || lowerText === "1") {
                    selectedPlatter =
                        platters.find((p) => p.slug.includes("residential")) || platters[0];
                } else if (lowerText.includes("commercial") || lowerText === "2") {
                    selectedPlatter =
                        platters.find((p) => p.slug.includes("commercial")) ||
                        platters[1] ||
                        platters[0];
                }

                if (!selectedPlatter) {
                    await this.reply(
                        client,
                        chatId,
                        `⚠️ Please reply with a valid platter number from *1 to ${platters.length}*:`,
                        session.step,
                    );
                    await this.sendPlatterMenu(client, chatId, senderName);
                    return;
                }

                // Save chosen platter
                await sessionService.updateSession(chatId, {
                    selectedPlatterId: selectedPlatter.id,
                });

                const hasKnownName = this.isValidName(session.name) || this.isValidName(senderName);

                if (hasKnownName) {
                    const validName = this.isValidName(session.name) ? session.name! : senderName!;
                    session.name = validName;
                    // Immediately show collateral list
                    await sessionService.updateSession(chatId, {
                        name: validName,
                        step: ChatStep.SELECT_COLLATERAL,
                    });
                    await this.sendPlatterCollateralMenu(client, chatId, selectedPlatter);
                    return;
                }

                // If name unknown, ask for full name
                await sessionService.updateSession(chatId, {
                    step: ChatStep.AWAITING_NAME,
                });

                const welcomeMsg =
                    `👋 Welcome to Northwind.\n\n` +
                    `Your personalized marketing creatives are just a tap away.\n` +
                    `✅ Ready-to-use\n` +
                    `✅ Co-branded with your name & number\n\n` +
                    `👉 *Please enter your full name to proceed:*`;

                await this.reply(client, chatId, welcomeMsg, ChatStep.AWAITING_NAME);
                break;
            }

            // 2. Full Name Input -> Directly show Collateral Menu
            case ChatStep.AWAITING_NAME: {
                const name = rawText.trim();
                if (!name || name.length < 2) {
                    await this.reply(
                        client,
                        chatId,
                        `⚠️ Please enter a valid full name:`,
                        ChatStep.AWAITING_NAME,
                    );
                    return;
                }

                session.name = name;
                await sessionService.updateSession(chatId, {
                    name,
                    step: ChatStep.SELECT_COLLATERAL,
                });

                const platter = await platterService.getPlatterById(
                    session.selectedPlatterId || "",
                );
                if (platter) {
                    await this.sendPlatterCollateralMenu(client, chatId, platter);
                } else {
                    const platters = await platterService.getAllPlatters();
                    await this.sendPlatterCollateralMenu(client, chatId, platters[0]);
                }
                break;
            }

            // Legacy steps fallback -> Directly show Collaterals
            case ChatStep.AWAITING_RERA:
            case ChatStep.AWAITING_FIRM_NAME:
            case ChatStep.CHOOSE_CHANNEL_PARTNER: {
                await sessionService.updateSession(chatId, {
                    step: ChatStep.SELECT_COLLATERAL,
                });
                const platter = await platterService.getPlatterById(
                    session.selectedPlatterId || "",
                );
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
                const platter = await platterService.getPlatterById(
                    session.selectedPlatterId || "",
                );
                if (!platter) {
                    await this.sendPlatterMenu(client, chatId, senderName);
                    return;
                }

                const activeCollaterals = await collateralService.getActiveCollateralsForPlatter(
                    platter.id,
                );
                const optMainMenu = activeCollaterals.length + 1;
                const totalOptions = optMainMenu;

                const choiceNum = parseInt(rawText.trim(), 10);

                if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > totalOptions) {
                    if (rawText === "0" || lowerText === "back" || lowerText === "menu") {
                        await this.sendPlatterMenu(client, chatId, senderName);
                        break;
                    }
                    await this.reply(
                        client,
                        chatId,
                        `⚠️ Please reply with a valid number from 1 to ${totalOptions} to choose your collateral.`,
                        session.step,
                    );
                    await this.sendPlatterCollateralMenu(client, chatId, platter);
                    break;
                }

                // Navigation 1: Return to main menu (Platters)
                if (
                    choiceNum === optMainMenu ||
                    rawText === "0" ||
                    lowerText === "menu" ||
                    lowerText === "back"
                ) {
                    await this.sendPlatterMenu(client, chatId, senderName);
                    break;
                }

                // Deliver selected collateral directly in background (no "rendering" status message)
                const selectedCollateral = activeCollaterals[choiceNum - 1];
                await this.deliverCollateral(
                    client,
                    chatId,
                    session,
                    platter,
                    selectedCollateral,
                    realPhone,
                );
                break;
            }

            // Collateral Confirmation Options
            case ChatStep.COLLATERAL_CONFIRMATION: {
                const choice = rawText.trim();
                const platter = await platterService.getPlatterById(
                    session.selectedPlatterId || "",
                );

                if (choice === "1" && platter) {
                    // Choose another collateral
                    await sessionService.updateSession(chatId, {
                        step: ChatStep.SELECT_COLLATERAL,
                    });
                    await this.sendPlatterCollateralMenu(client, chatId, platter);
                } else if (choice === "2") {
                    // Return to main menu (Platters)
                    await this.sendPlatterMenu(client, chatId, senderName);
                } else {
                    await this.reply(
                        client,
                        chatId,
                        `👉 Reply with *1* (Choose Another Collateral), or *2* (Main Menu),`,
                        session.step,
                    );
                }
                break;
            }

            // Dynamic FAQ Mode
            // case ChatStep.FAQ_MODE: {
            //   if (rawText === '0' || lowerText === 'menu' || lowerText === 'back') {
            //     await this.sendPlatterMenu(client, chatId, senderName);
            //     return;
            //   }

            //   const faqs = await faqService.getFaqs();
            //   const numChoice = parseInt(rawText, 10);

            //   if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= faqs.length) {
            //     const selectedFaq = faqs[numChoice - 1];
            //     const faqReply =
            //       `📌 *Q: ${selectedFaq.question}*\n\n` +
            //       `${selectedFaq.answer}\n\n` +
            //       `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            //       `👉 *Reply with another FAQ number (1 - ${faqs.length}), type a question, or reply 0 to return to Main Menu:*`;

            //     await this.reply(client, chatId, faqReply, ChatStep.FAQ_MODE);
            //     return;
            //   }

            //   // Try natural language / keyword match
            //   const match = await faqService.findBestMatch(rawText);
            //   if (match) {
            //     const faqReply =
            //       `📌 *Q: ${match.question}*\n\n` +
            //       `${match.answer}\n\n` +
            //       `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            //       `👉 *Reply with an FAQ number, type another question, or reply 0 for Main Menu:*`;
            //     await this.reply(client, chatId, faqReply, ChatStep.FAQ_MODE);
            //     return;
            //   }

            //   // Default: display FAQ menu again
            //   await this.reply(
            //     client,
            //     chatId,
            //     `ℹ️ No exact answer found for "${rawText}". Here are the available FAQ topics:\n*(Or reply 0 to return to Main Menu)*`,
            //     ChatStep.FAQ_MODE
            //   );
            //   await this.sendFaqMenu(client, chatId);
            //   break;
            // }

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

        let platterOptions = "";
        platters.forEach((p, idx) => {
            const emoji = this.getNumberEmoji(idx);
            const icon = p.slug.includes("residential")
                ? "🏡"
                : p.slug.includes("commercial")
                  ? "🏢"
                  : "🌟";
            platterOptions += `${emoji} ${icon} *${p.name}* ${p.tagline ? `(${p.tagline})` : ""}\n`;
        });

        const hasRealName = this.isValidName(partnerName);
        const greetingLine = hasRealName
            ? `Dear *${partnerName!.trim()}*,\n\nWelcome to ${process.env.PROJECT_NAME || "Northwind"} Chatbot.\n\n`
            : `Welcome to ${process.env.PROJECT_NAME || "Northwind"} Chatbot.\n\n`;

        const menuMsg =
            greetingLine +
            `Please select a project category from the platter below:\n\n` +
            platterOptions +
            `\n👉 *Reply with a number (1 - ${platters.length}):*`;

        await this.reply(client, to, menuMsg, ChatStep.SELECT_PLATTER);
    }

    /**
     * Resolves a WhatsApp display emoji for a collateral.
     * When item.icon stores an uploaded file URL or path, returns an appropriate emoji based on code/fileType.
     */
    private getCollateralEmoji(item: CollateralItem): string {
        const rawIcon = (item.icon || "").trim();

        const isUrlOrPath =
            !rawIcon ||
            rawIcon.startsWith("/") ||
            rawIcon.startsWith("http://") ||
            rawIcon.startsWith("https://") ||
            rawIcon.startsWith("uploads") ||
            rawIcon.includes("/") ||
            rawIcon.includes("\\") ||
            /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(rawIcon);

        if (!isUrlOrPath) {
            return rawIcon;
        }

        const code = (item.code || "").toUpperCase();
        switch (code) {
            case "STORY":
            case "WHATSAPP_STORY":
                return "📱";
            case "EDM":
            case "WHATSAPP_EDM":
                return "✨";
            case "VIDEO":
            case "WHATSAPP_VIDEO":
                return "🎥";
            case "BROCHURE":
                return "📄";
            case "FLOOR_PLANS":
            case "FLOOR_PLAN":
                return "📐";
            case "OPP_DOC":
                return "📑";
        }

        const fileType = String(item.fileType || "").toLowerCase();
        if (fileType === "image") return "🖼️";
        if (fileType === "video") return "🎥";
        if (fileType === "link") return "🔗";

        return "📄";
    }

    /**
     * Displays list of collaterals for selected Platter.
     */
    public async sendPlatterCollateralMenu(
        client: Client,
        to: string,
        platter: any,
    ): Promise<void> {
        await sessionService.updateSession(to, { step: ChatStep.SELECT_COLLATERAL });

        const activeCollaterals = await collateralService.getActiveCollateralsForPlatter(
            platter.id,
        );

        let collateralOptions = "";
        activeCollaterals.forEach((item, index) => {
            const emoji = this.getNumberEmoji(index);
            const icon = this.getCollateralEmoji(item);
            const sub = item.subtitle ? ` ${item.subtitle}` : "";
            collateralOptions += `${emoji} ${icon} *${item.title}*${sub}\n`;
        });

        const optMainMenu = activeCollaterals.length + 1;
        const totalOptions = optMainMenu;

        const navOptions = `\n${this.getNumberEmoji(optMainMenu - 1)} 🏠 *Return to Main Menu (Platters)*\n`;

        const menuText =
            `Please select your personalized marketing collaterals from the list below for *${platter.name}*:\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            collateralOptions +
            navOptions +
            `👉 *Reply with a number (1 - ${totalOptions}):*`;

        await this.reply(client, to, menuText, ChatStep.SELECT_COLLATERAL);
    }

    /**
     * Helper to parse one or multiple media URLs/paths from fileUrl
     */
    private parseMediaUrls(fileUrl?: string | null): string[] {
        if (!fileUrl) return [];
        const trimmed = fileUrl.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map((s) => String(s).trim()).filter(Boolean);
                }
            } catch {
                // fallback
            }
        }
        return trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    /**
     * Helper to extract active media URLs for a collateral from DB records (mediaItems / CollateralMedia table)
     * or parsed fileUrl as fallback
     */
    private async getCollateralMediaUrls(collateral: CollateralItem): Promise<string[]> {
        // 1. If mediaItems already loaded with collateral object
        if (collateral.mediaItems && collateral.mediaItems.length > 0) {
            const activeUrls = collateral.mediaItems.filter((m) => m.status).map((m) => m.fileUrl);
            if (activeUrls.length > 0) return activeUrls;
        }

        // 2. Query database for active CollateralMedia
        if (collateral.id) {
            try {
                const dbItems = await prisma.collateralMedia.findMany({
                    where: {
                        collateralId: collateral.id,
                        status: true,
                    },
                    orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
                });
                if (dbItems.length > 0) {
                    return dbItems.map((item: any) => item.fileUrl);
                }
            } catch (err) {
                console.error("Error fetching collateral media from DB:", err);
            }
        }

        // 3. Fallback to fileUrl string
        return this.parseMediaUrls(collateral.fileUrl);
    }

    /**
     * Formats a file path or URL for public/database consistency (e.g. /uploads/...)
     */
    private formatMediaUrl(url?: string | null): string | undefined {
        if (!url) return undefined;
        const trimmed = url.trim();
        if (!trimmed) return undefined;
        return trimmed.startsWith("/") ||
            trimmed.startsWith("http://") ||
            trimmed.startsWith("https://")
            ? trimmed
            : `/${trimmed}`;
    }

    /**
     * Delivers the selected collateral in background without rendering messages.
     * Supports single/multiple images with watermarks, custom EDM content, videos, PDFs, and custom platter items.
     */
    private async deliverCollateral(
        client: Client,
        chatId: string,
        session: any,
        platter: any,
        collateral: CollateralItem,
        realPhone: string,
    ): Promise<void> {
        let userName = (session.name || "").trim();
        if (!this.isValidName(userName)) {
            const cleanPhone = (realPhone || session.phone || "").replace(/\D/g, "").slice(-10);
            if (cleanPhone.length >= 10) {
                const cp = await channelPartnerService.findByPhone(cleanPhone);
                if (cp?.fullName && this.isValidName(cp.fullName)) {
                    userName = cp.fullName.trim();
                }
            }
        }

        if (!this.isValidName(userName)) {
            userName = "";
        }

        const userMobile = formatPhone(session.phone || realPhone);
        const code = (collateral.code || "").toUpperCase();
        const isResidential =
            (platter.slug || "").toLowerCase().includes("residential") ||
            (platter.name || "").toLowerCase().includes("residential");

        // 1. STORY (Personalized) - Only delivers real uploaded images with user name and mobile watermark
        if (code === "STORY" || code === "WHATSAPP_STORY") {
            const mediaList = await this.getCollateralMediaUrls(collateral);
            if (mediaList.length > 0) {
                let sentCount = 0;
                for (let idx = 0; idx < mediaList.length; idx++) {
                    const resolvedPath = projectService.resolvePath(mediaList[idx]);
                    if (resolvedPath && fs.existsSync(resolvedPath)) {
                        try {
                            const watermarkedImg = await watermarkService.watermarkImage(
                                resolvedPath,
                                userName,
                                userMobile,
                            );
                            const media = new MessageMedia(
                                "image/jpeg",
                                watermarkedImg.toString("base64"),
                                `Story_${idx + 1}.jpg`,
                            );
                            // Sent ONLY images with watermark - no explanation captions
                            await client.sendMessage(chatId, media);
                            const fileUrl = this.formatMediaUrl(mediaList[idx]) || mediaList[idx];
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                fileUrl,
                                ChatStep.SELECT_COLLATERAL,
                                "image",
                                fileUrl,
                            );
                            sentCount++;
                        } catch (err) {
                            console.error(`Error watermarking story image ${mediaList[idx]}:`, err);
                        }
                    }
                }
                if (sentCount > 0) {
                    await this.sendConfirmationOptions(client, chatId, platter.name);
                    return;
                }
            }

            // No static fake flyer! Send clean informative message if no media uploaded
            const noMediaMsg =
                `📱 *${collateral.title} - ${platter.name}*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⚠️ No story media has been uploaded yet for this platter.\n\n` +
                `Please upload media items via the Collateral API to enable instant watermarked delivery.\n\n` +
                `👤 *Channel Partner:* ${userName}\n` +
                `📞 *To know more, call:* ${userMobile}`;

            await this.reply(client, chatId, noMediaMsg, ChatStep.SELECT_COLLATERAL);
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 2. EDM (Personalized) - Fully dynamic project content from database + uploaded media
        if (code === "EDM" || code === "WHATSAPP_EDM") {
            let edmText = (collateral.content || "").trim();

            // If no custom text in collateral record, dynamically build from Platter's projects in DB
            if (!edmText) {
                const platterProjects = await prisma.projects.findMany({
                    where: { platterId: platter.id, status: true },
                    include: { projectReras: true },
                    orderBy: { seq: "asc" },
                });

                if (platterProjects.length > 0) {
                    edmText =
                        `💎 *Exclusive ${platter.name} Opportunities*\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

                    for (const proj of platterProjects) {
                        edmText += `✨ *${proj.projectName}*\n`;
                        if (proj.location) edmText += `📍 *Location:* ${proj.location}\n`;
                        if (proj.priceRange) edmText += `💰 *Pricing:* ${proj.priceRange}\n`;
                        if (proj.tagline) edmText += `🏷️ ${proj.tagline}\n`;
                        if (proj.shortDescription) edmText += `📝 ${proj.shortDescription}\n`;
                        const reras = proj.projectReras
                            ?.map((r: any) => r.reraNumber)
                            .filter(Boolean);
                        if (reras && reras.length > 0) {
                            edmText += `📑 *RERA:* ${reras.join(", ")}\n`;
                        }
                        edmText += `\n`;
                    }

                    edmText +=
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `Price, inventory & offers subject to availability.\n\n` +
                        `Regards,\n` +
                        `${userName} : ${userMobile}`;
                } else {
                    edmText =
                        `💎 *${platter.name}*\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `${platter.description || "Exclusive commercial & residential portfolio."}\n\n` +
                        `Regards,\n` +
                        `${userName} : ${userMobile}`;
                }
            }

            // Check if real media was uploaded for EDM
            const mediaList = await this.getCollateralMediaUrls(collateral);
            if (mediaList.length > 0) {
                const resolvedPath = projectService.resolvePath(mediaList[0]);
                if (resolvedPath && fs.existsSync(resolvedPath)) {
                    try {
                        const watermarkedImg = await watermarkService.watermarkImage(
                            resolvedPath,
                            userName,
                            userMobile,
                        );
                        const media = new MessageMedia(
                            "image/jpeg",
                            watermarkedImg.toString("base64"),
                            "EDM.jpg",
                        );
                        await client.sendMessage(chatId, media, { caption: edmText });
                        const edmMediaUrl = this.formatMediaUrl(mediaList[0]);
                        await chatRecordService.recordOutgoingMessage(
                            chatId,
                            edmMediaUrl || edmText,
                            ChatStep.SELECT_COLLATERAL,
                            "image",
                            edmMediaUrl,
                        );
                        await this.sendConfirmationOptions(client, chatId, platter.name);
                        return;
                    } catch (err) {
                        console.error("Error watermarking uploaded EDM image:", err);
                    }
                }
            }

            // NO static flyer! Deliver dynamic EDM copy directly
            await this.reply(client, chatId, edmText, ChatStep.SELECT_COLLATERAL);
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 3. VIDEO (Personalized)
        if (code === "VIDEO" || code === "WHATSAPP_VIDEO") {
            const mediaList = await this.getCollateralMediaUrls(collateral);
            if (mediaList.length > 0) {
                let sentCount = 0;
                for (let idx = 0; idx < mediaList.length; idx++) {
                    const videoPath = projectService.resolvePath(mediaList[idx]);
                    if (videoPath && fs.existsSync(videoPath)) {
                        try {
                            const media = MessageMedia.fromFilePath(videoPath);
                            const partText =
                                mediaList.length > 1 ? ` (${idx + 1}/${mediaList.length})` : "";
                            const caption =
                                `🎥 *${collateral.title}${partText}*\n` +
                                `🏢 *${platter.name}*\n` +
                                `📞 *To know more, call ${userName}: ${userMobile}*`;
                            await client.sendMessage(chatId, media, { caption });
                            const videoUrl = this.formatMediaUrl(mediaList[idx]);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                videoUrl || caption,
                                ChatStep.SELECT_COLLATERAL,
                                "video",
                                videoUrl,
                            );
                            sentCount++;
                        } catch (err: any) {
                            console.error("Error sending video:", err);
                        }
                    }
                }
                if (sentCount > 0) {
                    await this.sendConfirmationOptions(client, chatId, platter.name);
                    return;
                }
            }

            const videoMsg =
                `🎥 *${collateral.title}*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `Official promotional video walkthrough personalized with your details:\n\n` +
                `👤 *Channel Partner:* ${userName}\n` +
                `📞 *To know more, call:* ${userMobile}\n\n` +
                `${collateral.content || "Video walkthrough media available in Partner Media Desk."}`;

            await this.reply(client, chatId, videoMsg, ChatStep.SELECT_COLLATERAL);
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 4. BROCHURE
        if (code === "BROCHURE") {
            try {
                const mediaList = await this.getCollateralMediaUrls(collateral);
                let brochurePath =
                    mediaList[0] ||
                    collateralService.getDefaultFileForPlatter(platter.slug, "BROCHURE");
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
                        session.firmName || "",
                        session.reraNumber || "",
                    );

                    const fileName = `${platter.name.replace(/[^a-zA-Z0-9]/g, "_")}_Brochure.pdf`;
                    const media = new MessageMedia(
                        "application/pdf",
                        watermarkedPdf.toString("base64"),
                        fileName,
                    );

                    const pdfCaption =
                        `📄 *Official Project Brochure: ${platter.name}*\n` +
                        `📞 *To know more, call ${userName}: ${userMobile}*`;

                    await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
                    await client.sendMessage(chatId, pdfCaption);
                    const brochureUrl = this.formatMediaUrl(brochurePath);
                    await chatRecordService.recordOutgoingMessage(
                        chatId,
                        brochureUrl || pdfCaption,
                        ChatStep.SELECT_COLLATERAL,
                        "pdf",
                        brochureUrl,
                    );
                } else {
                    await this.reply(
                        client,
                        chatId,
                        `📄 *${collateral.title}*\n\nBrochure document is being updated by the administration team for ${platter.name}.`,
                        ChatStep.SELECT_COLLATERAL,
                    );
                }
            } catch (err: any) {
                console.error("Error generating brochure:", err);
                await this.reply(
                    client,
                    chatId,
                    `⚠️ Error creating brochure: ${err.message}`,
                    ChatStep.SELECT_COLLATERAL,
                );
            }
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 5. FLOOR_PLANS (Multiple images / layouts with watermark)
        if (code === "FLOOR_PLANS" || code === "FLOOR_PLAN") {
            try {
                const mediaList = await this.getCollateralMediaUrls(collateral);
                if (mediaList.length === 0) {
                    const defaultPlan = collateralService.getDefaultFileForPlatter(
                        platter.slug,
                        "FLOOR_PLANS",
                    );
                    if (defaultPlan) mediaList.push(defaultPlan);
                }

                let sentCount = 0;
                for (let idx = 0; idx < mediaList.length; idx++) {
                    const resolvedPlan = projectService.resolvePath(mediaList[idx]);
                    if (resolvedPlan && fs.existsSync(resolvedPlan)) {
                        const isPdf = resolvedPlan.toLowerCase().endsWith(".pdf");
                        const partText =
                            mediaList.length > 1 ? ` (${idx + 1}/${mediaList.length})` : "";
                        const planUrl = this.formatMediaUrl(mediaList[idx]);

                        if (isPdf) {
                            const watermarkedPdf = await watermarkService.watermarkPdf(
                                resolvedPlan,
                                userName,
                                userMobile,
                                session.firmName || "",
                                session.reraNumber || "",
                            );
                            const media = new MessageMedia(
                                "application/pdf",
                                watermarkedPdf.toString("base64"),
                                `${platter.name.replace(/[^a-zA-Z0-9]/g, "_")}_Floor_Plan_${idx + 1}.pdf`,
                            );
                            const caption =
                                `📐 *${collateral.title}${partText} - ${platter.name}*\n` +
                                `🏢 *Category:* ${platter.name}\n` +
                                `📞 *To know more, call ${userName}: ${userMobile}*`;

                            await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
                            await client.sendMessage(chatId, caption);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                planUrl || caption,
                                ChatStep.SELECT_COLLATERAL,
                                "document",
                                planUrl,
                            );
                            sentCount++;
                        } else {
                            const watermarkedImg = await watermarkService.watermarkImage(
                                resolvedPlan,
                                userName,
                                userMobile,
                            );

                            const media = new MessageMedia(
                                "image/jpeg",
                                watermarkedImg.toString("base64"),
                                `${platter.name.replace(/[^a-zA-Z0-9]/g, "_")}_Floor_Plan_${idx + 1}.jpg`,
                            );

                            // Sent ONLY images with watermark - no explanation captions
                            await client.sendMessage(chatId, media);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                planUrl || `[Floor Plan: ${collateral.title}]`,
                                ChatStep.SELECT_COLLATERAL,
                                "image",
                                planUrl,
                            );
                            sentCount++;
                        }
                    }
                }

                if (sentCount > 0) {
                    await this.sendConfirmationOptions(client, chatId, platter.name);
                    return;
                }
            } catch (err: any) {
                console.error("Error delivering floor plan:", err);
            }

            const planMsg =
                `📐 *OFFICIAL MASTER LAYOUT & FLOOR PLANS*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🏢 *Category:* ${platter.name}\n` +
                `📍 *Location:* Prime Noida Expressway & Central Noida\n\n` +
                `${collateral.content || "• High-Street Open Retail Layouts & Atrium-Led Architecture\n• Anchor Stores, Hypermarkets & Experiential Zones\n• Flexible unit configurations with grand ceiling heights."}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📞 *To know more, call:* ${userName} (${userMobile})`;

            await this.reply(client, chatId, planMsg, ChatStep.SELECT_COLLATERAL);
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 6. OPP_DOC (Documents / PDF with watermark)
        if (code === "OPP_DOC") {
            try {
                const mediaList = await this.getCollateralMediaUrls(collateral);
                if (mediaList.length === 0) {
                    const defaultOpp = collateralService.getDefaultFileForPlatter(
                        platter.slug,
                        "OPP_DOC",
                    );
                    if (defaultOpp) mediaList.push(defaultOpp);
                }

                let sentCount = 0;
                for (let idx = 0; idx < mediaList.length; idx++) {
                    const resolvedOpp = projectService.resolvePath(mediaList[idx]);
                    if (resolvedOpp && fs.existsSync(resolvedOpp)) {
                        const isPdf = resolvedOpp.toLowerCase().endsWith(".pdf");
                        const partText =
                            mediaList.length > 1 ? ` (${idx + 1}/${mediaList.length})` : "";

                        if (isPdf) {
                            const watermarkedPdf = await watermarkService.watermarkPdf(
                                resolvedOpp,
                                userName,
                                userMobile,
                                session.firmName || "",
                                session.reraNumber || "",
                            );

                            const fileName = `${platter.name.replace(/[^a-zA-Z0-9]/g, "_")}_Opportunity_Doc_${idx + 1}.pdf`;
                            const media = new MessageMedia(
                                "application/pdf",
                                watermarkedPdf.toString("base64"),
                                fileName,
                            );

                            const caption =
                                `📑 *${collateral.title}${partText} - ${platter.name}*\n` +
                                `📞 *To know more, call ${userName}: ${userMobile}*`;

                            await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
                            await client.sendMessage(chatId, caption);
                            const oppUrl = this.formatMediaUrl(mediaList[idx]);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                oppUrl || caption,
                                ChatStep.SELECT_COLLATERAL,
                                "document",
                                oppUrl,
                            );
                            sentCount++;
                        } else {
                            const media = MessageMedia.fromFilePath(resolvedOpp);
                            await client.sendMessage(chatId, media);
                            const oppUrl = this.formatMediaUrl(mediaList[idx]);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                oppUrl || `[Opportunity Document: ${collateral.title}]`,
                                ChatStep.SELECT_COLLATERAL,
                                "document",
                                oppUrl,
                            );
                            sentCount++;
                        }
                    }
                }

                if (sentCount > 0) {
                    await this.sendConfirmationOptions(client, chatId, platter.name);
                    return;
                }
            } catch (err: any) {
                console.error("Error delivering opp doc:", err);
            }

            const oppMsg =
                `📑 *EXCLUSIVE INVESTMENT OPPORTUNITY DOCUMENT (OPP DOC)*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🏢 *Category:* ${platter.name}\n\n` +
                `${collateral.content || "✨ High-growth commercial and luxury residential investment portfolios.\n💰 Flexible 40:60 payment plans, high rental yields, and attractive lease guarantee options."}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📞 *To know more, call:* ${userName} (${userMobile})`;

            await this.reply(client, chatId, oppMsg, ChatStep.SELECT_COLLATERAL);
            await this.sendConfirmationOptions(client, chatId, platter.name);
            return;
        }

        // 7. Custom / Dynamically Added Platter Collateral (Handles images, PDFs, videos, or text)
        const mediaList = await this.getCollateralMediaUrls(collateral);
        if (mediaList.length > 0) {
            let sentCount = 0;
            for (let idx = 0; idx < mediaList.length; idx++) {
                const filePath = projectService.resolvePath(mediaList[idx]);
                if (filePath && fs.existsSync(filePath)) {
                    const partText =
                        mediaList.length > 1 ? ` (${idx + 1}/${mediaList.length})` : "";
                    const customUrl = this.formatMediaUrl(mediaList[idx]);
                    const caption =
                        `📑 *${collateral.title.toUpperCase()}${partText}*\n` +
                        `🏢 *Platter:* ${platter.name}\n` +
                        `📞 *To know more, call ${userName}: ${userMobile}*`;

                    if (
                        collateral.fileType === "image" ||
                        filePath.match(/\.(jpg|jpeg|png|webp)$/i)
                    ) {
                        try {
                            const watermarked = await watermarkService.watermarkImage(
                                filePath,
                                userName,
                                userMobile,
                            );
                            const media = new MessageMedia(
                                "image/jpeg",
                                watermarked.toString("base64"),
                                `${collateral.title}_${idx + 1}.jpg`,
                            );
                            // Sent ONLY images with watermark - no explanation captions
                            await client.sendMessage(chatId, media);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                customUrl || `[Image: ${collateral.title}]`,
                                ChatStep.SELECT_COLLATERAL,
                                "image",
                                customUrl,
                            );
                            sentCount++;
                        } catch (err) {
                            console.error("Error watermarking custom image:", err);
                        }
                    } else if (collateral.fileType === "document" || filePath.match(/\.pdf$/i)) {
                        try {
                            const watermarkedPdf = await watermarkService.watermarkPdf(
                                filePath,
                                userName,
                                userMobile,
                                session.firmName || "",
                                session.reraNumber || "",
                            );
                            const media = new MessageMedia(
                                "application/pdf",
                                watermarkedPdf.toString("base64"),
                                `${collateral.title}_${idx + 1}.pdf`,
                            );
                            await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
                            await client.sendMessage(chatId, caption);
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                customUrl || caption,
                                ChatStep.SELECT_COLLATERAL,
                                "document",
                                customUrl,
                            );
                            sentCount++;
                        } catch (err) {
                            console.error("Error watermarking custom pdf:", err);
                        }
                    } else if (
                        collateral.fileType === "video" ||
                        filePath.match(/\.(mp4|mov|avi|mkv)$/i)
                    ) {
                        try {
                            const media = MessageMedia.fromFilePath(filePath);
                            await client.sendMessage(chatId, media, { caption });
                            await chatRecordService.recordOutgoingMessage(
                                chatId,
                                customUrl || caption,
                                ChatStep.SELECT_COLLATERAL,
                                "video",
                                customUrl,
                            );
                            sentCount++;
                        } catch (err) {
                            console.error("Error sending custom video:", err);
                        }
                    }
                }
            }

            if (sentCount > 0) {
                await this.sendConfirmationOptions(client, chatId, platter.name);
                return;
            }
        }

        // Plain text content fallback for custom item
        const customContent = collateral.content || `${collateral.title} for ${platter.name}`;
        const customMsg =
            `📑 *${collateral.title.toUpperCase()}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${customContent}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💼 *Personalized for:* ${userName} (${session.firmName || "Realty Advisor"})\n` +
            `📜 *RERA:* ${session.reraNumber || "Verified"}\n` +
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
        categoryName: string,
    ): Promise<void> {
        await sessionService.updateSession(to, { step: ChatStep.COLLATERAL_CONFIRMATION });

        const confirmMsg =
            `✅ *Selected Marketing Collateral Delivered Successfully!*\n\n` +
            `👉 *What would you like to do next?*\n` +
            `1️⃣ 🎨 *Choose another collateral for ${categoryName}*\n` +
            `2️⃣ 🏠 *Return to main menu*`;

        await this.reply(client, to, confirmMsg, ChatStep.COLLATERAL_CONFIRMATION);
    }

    /**
     * Helper to format index into emoji numbers: 1️⃣, 2️⃣, ..., 🔟
     */
    private getNumberEmoji(index: number): string {
        const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
        return emojis[index] || `[${index + 1}]`;
    }

    /**
     * Dynamic FAQ Menu retrieved from database.
     */
    // public async sendFaqMenu(client: Client, to: string): Promise<void> {
    //   await sessionService.updateSession(to, { step: ChatStep.FAQ_MODE });

    //   const faqs = await faqService.getFaqs();

    //   let faqText = `❓ *Northwind - FREQUENTLY ASKED QUESTIONS (FAQ)*\n`;
    //   faqText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    //   faqs.forEach((faq, idx) => {
    //     faqText += `*${idx + 1}️⃣ ${faq.question}*\n`;
    //   });

    //   faqText += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    //   faqText += `👉 *Reply with a question number (1 - ${faqs.length}) to view the answer.*\n`;
    //   faqText += `Or simply type your question in English/Hindi!\n`;
    //   faqText += `*(Reply 0 to return to Main Menu)*`;

    //   await this.reply(client, to, faqText, ChatStep.FAQ_MODE);
    // }
}

export const botService = new BotService();
