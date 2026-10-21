import { ChatStep, UserSession } from '../types/index.js';

export class SessionService {
  private sessions: Map<string, UserSession> = new Map();

  public getSession(chatId: string, initialPhone: string = ''): UserSession {
    let session = this.sessions.get(chatId);
    if (!session) {
      session = {
        chatId,
        phone: initialPhone,
        step: ChatStep.INITIAL,
        lastActive: new Date()
      };
      this.sessions.set(chatId, session);
    } else if (initialPhone && (!session.phone || session.phone.length > 13 || session.phone.includes('lid'))) {
      session.phone = initialPhone;
    }
    return session;
  }

  public updateSession(chatId: string, updates: Partial<UserSession>): UserSession {
    const session = this.getSession(chatId);
    const updated = {
      ...session,
      ...updates,
      lastActive: new Date()
    };
    this.sessions.set(chatId, updated);
    return updated;
  }

  public resetSession(chatId: string, realPhone: string = ''): UserSession {
    const session: UserSession = {
      chatId,
      phone: realPhone,
      step: ChatStep.INITIAL,
      lastActive: new Date()
    };
    this.sessions.set(chatId, session);
    return session;
  }
}

export const sessionService = new SessionService();
