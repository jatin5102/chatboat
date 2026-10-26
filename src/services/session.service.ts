import { ChatStep, UserSession } from "../types/index.js";
import { chatRecordService } from "./chatRecord.service.js";

export class SessionService {
  private cache: Map<string, UserSession> = new Map();

  /**
   * Retrieves user session, loading from PostgreSQL DB if not in local cache.
   */
  public async getSession(chatId: string, initialPhone: string = ""): Promise<UserSession> {
    let session = this.cache.get(chatId);
    if (!session) {
      session = await chatRecordService.getOrCreateSession(chatId, initialPhone);
      this.cache.set(chatId, session);
    } else if (
      initialPhone &&
      (!session.phone || session.phone.length > 13 || session.phone.includes("lid"))
    ) {
      session.phone = initialPhone;
      await chatRecordService.updateSession(chatId, { phone: initialPhone });
    }
    return session;
  }

  /**
   * Synchronous cached retrieval for quick lookup when guaranteed cached.
   */
  public getSessionSync(chatId: string, initialPhone: string = ""): UserSession {
    let session = this.cache.get(chatId);
    if (!session) {
      session = {
        chatId,
        phone: initialPhone,
        step: ChatStep.INITIAL,
        lastActive: new Date(),
      };
      this.cache.set(chatId, session);
      // Asynchronously persist in DB
      chatRecordService.getOrCreateSession(chatId, initialPhone).catch(console.error);
    }
    return session;
  }

  /**
   * Updates user session in cache and persists to PostgreSQL database.
   */
  public async updateSession(chatId: string, updates: Partial<UserSession>): Promise<UserSession> {
    const session = await this.getSession(chatId);
    const updated: UserSession = {
      ...session,
      ...updates,
      lastActive: new Date(),
    };
    this.cache.set(chatId, updated);
    await chatRecordService.updateSession(chatId, updates);
    return updated;
  }

  /**
   * Resets session state in cache and PostgreSQL database.
   */
  public async resetSession(chatId: string, realPhone: string = ""): Promise<UserSession> {
    const session: UserSession = {
      chatId,
      phone: realPhone,
      step: ChatStep.INITIAL,
      lastActive: new Date(),
    };
    this.cache.set(chatId, session);
    await chatRecordService.resetSession(chatId, realPhone);
    return session;
  }
}

export const sessionService = new SessionService();
