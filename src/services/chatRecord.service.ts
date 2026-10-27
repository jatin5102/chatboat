import { prisma } from "../config/prisma.config.js";
import { ChatStep, UserRole, UserSession } from "../types/index.js";
import { BotProject } from "./project.service.js";

export class ChatRecordService {
  /**
   * Retrieves or creates a chat session in the database.
   */
  public async getOrCreateSession(chatId: string, phone: string = ""): Promise<UserSession> {
    try {
      const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
      
      let dbSession = await prisma.chatbotSession.findUnique({
        where: { chatId },
      });

      if (!dbSession) {
        dbSession = await prisma.chatbotSession.create({
          data: {
            chatId,
            phone: cleanPhone,
            step: ChatStep.INITIAL,
            lastActive: new Date(),
          },
        });
      } else if (cleanPhone && (!dbSession.phone || dbSession.phone.length > 13 || dbSession.phone.includes("lid"))) {
        dbSession = await prisma.chatbotSession.update({
          where: { chatId },
          data: { phone: cleanPhone, lastActive: new Date() },
        });
      }

      return {
        chatId: dbSession.chatId,
        phone: dbSession.phone,
        name: dbSession.name || undefined,
        firmName: dbSession.firmName || undefined,
        location: dbSession.location || undefined,
        role: (dbSession.role as UserRole) || undefined,
        reraNumber: dbSession.reraNumber || undefined,
        step: (dbSession.step as ChatStep) || ChatStep.INITIAL,
        selectedPlatterId: dbSession.selectedPlatterId || undefined,
        selectedPropertyId: dbSession.selectedPropertyId || undefined,
        channelPartnerId: dbSession.channelPartnerId || undefined,
        lastActive: dbSession.lastActive,
      };
    } catch (error) {
      console.error("[ChatRecordService] Error in getOrCreateSession:", error);
      return {
        chatId,
        phone,
        step: ChatStep.INITIAL,
        lastActive: new Date(),
      };
    }
  }

  /**
   * Updates an existing session in the database.
   */
  public async updateSession(chatId: string, updates: Partial<UserSession>): Promise<void> {
    try {
      const updateData: any = {
        lastActive: new Date(),
      };

      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.firmName !== undefined) updateData.firmName = updates.firmName;
      if (updates.location !== undefined) updateData.location = updates.location;
      if (updates.role !== undefined) updateData.role = updates.role;
      if (updates.reraNumber !== undefined) updateData.reraNumber = updates.reraNumber;
      if (updates.step !== undefined) updateData.step = updates.step;
      if (updates.selectedPlatterId !== undefined) updateData.selectedPlatterId = updates.selectedPlatterId;
      if (updates.selectedPropertyId !== undefined) updateData.selectedPropertyId = updates.selectedPropertyId;
      if (updates.channelPartnerId !== undefined) updateData.channelPartnerId = updates.channelPartnerId;

      await prisma.chatbotSession.upsert({
        where: { chatId },
        create: {
          chatId,
          phone: updates.phone || "",
          name: updates.name,
          firmName: updates.firmName,
          location: updates.location,
          role: updates.role,
          reraNumber: updates.reraNumber,
          step: updates.step || ChatStep.INITIAL,
          selectedPlatterId: updates.selectedPlatterId,
          selectedPropertyId: updates.selectedPropertyId,
          channelPartnerId: updates.channelPartnerId,
          lastActive: new Date(),
        },
        update: updateData,
      });
    } catch (error) {
      console.error("[ChatRecordService] Error updating session:", error);
    }
  }

  /**
   * Resets a user's session flow in the database.
   */
  public async resetSession(chatId: string, phone: string = ""): Promise<void> {
    try {
      await prisma.chatbotSession.upsert({
        where: { chatId },
        create: {
          chatId,
          phone,
          step: ChatStep.INITIAL,
          lastActive: new Date(),
        },
        update: {
          step: ChatStep.INITIAL,
          selectedPropertyId: null,
          selectedPlatterId: null,
          lastActive: new Date(),
        },
      });
    } catch (error) {
      console.error("[ChatRecordService] Error resetting session:", error);
    }
  }

  /**
   * Records an incoming message into the database.
   */
  public async recordIncomingMessage(
    chatId: string,
    messageText: string,
    step: string,
    metadata?: any
  ): Promise<void> {
    try {
      const session = await prisma.chatbotSession.findUnique({
        where: { chatId },
      });

      if (!session) return;

      await prisma.chatbotMessage.create({
        data: {
          sessionId: session.id,
          chatId,
          direction: "INCOMING",
          step,
          message: messageText,
          mediaType: "text",
          metadata: metadata || null,
        },
      });
    } catch (error) {
      console.error("[ChatRecordService] Error recording incoming message:", error);
    }
  }

  /**
   * Records an outgoing bot response (text, document, or media) into the database.
   */
  public async recordOutgoingMessage(
    chatId: string,
    messageText: string,
    step: string,
    mediaType: "text" | "pdf" | "image" | "video" | "document" = "text",
    mediaUrl?: string,
    metadata?: any
  ): Promise<void> {
    try {
      const session = await prisma.chatbotSession.findUnique({
        where: { chatId },
      });

      if (!session) return;

      await prisma.chatbotMessage.create({
        data: {
          sessionId: session.id,
          chatId,
          direction: "OUTGOING",
          step,
          message: messageText,
          mediaType,
          mediaUrl: mediaUrl || null,
          metadata: metadata || null,
        },
      });
    } catch (error) {
      console.error("[ChatRecordService] Error recording outgoing message:", error);
    }
  }

  /**
   * Records leads/enquiries into projectEnquiry or channelPartnerEnquiry tables in PostgreSQL.
   */
  public async recordLead(
    session: UserSession,
    project?: BotProject,
    action: string = "INQUIRY"
  ): Promise<void> {
    try {
      const phone = session.phone || session.chatId.replace(/\D/g, "");
      const fullName = session.name || "WhatsApp Lead";

      if (session.role === "CHANNEL_PARTNER") {
        await prisma.channelPartnerEnquiry.create({
          data: {
            fullName,
            mobileNo: phone,
            emailAddress: `${phone}@whatsapp.lead`,
            location: session.location || "Not specified",
            agencyName: session.reraNumber || "Broker Desk",
            reraCertifiedNo: session.reraNumber || null,
            message: `Lead generated via WhatsApp Chatbot. Action: ${action}${project ? ` | Project: ${project.name}` : ""}`,
            status: true,
          },
        });
        console.log(`[ChatRecordService] 💼 Channel Partner Enquiry recorded in DB for ${fullName} (${phone})`);
      } else {
        await prisma.projectEnquiry.create({
          data: {
            fullName,
            mobileNo: phone,
            emailAddress: `${phone}@whatsapp.lead`,
            projectId: project?.id || null,
            projectName: project?.name || null,
            query: `WhatsApp Bot Action: ${action} | Preferred City: ${session.location || "Not specified"}`,
            classification: "WhatsApp Bot",
            remarks: `Captured via WhatsApp flow. Selected Project: ${project?.name || "Browsing"}`,
          },
        });
        console.log(`[ChatRecordService] 🏡 Project Buyer Enquiry recorded in DB for ${fullName} (${phone})`);
      }
    } catch (error) {
      console.error("[ChatRecordService] Error recording lead enquiry:", error);
    }
  }
}

export const chatRecordService = new ChatRecordService();
