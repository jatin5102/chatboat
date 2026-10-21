import { ChatStep, UserSession } from '../types/index.js';

export class SessionService {
  private sessions: Map<string, UserSession> = new Map();

  public getSession(phone: string): UserSession {
    let session = this.sessions.get(phone);
    if (!session) {
      session = {
        phone,
        step: ChatStep.INITIAL,
        lastActive: new Date()
      };
      this.sessions.set(phone, session);
    }
    return session;
  }

  public updateSession(phone: string, updates: Partial<UserSession>): UserSession {
    const session = this.getSession(phone);
    const updated = {
      ...session,
      ...updates,
      lastActive: new Date()
    };
    this.sessions.set(phone, updated);
    return updated;
  }

  public resetSession(phone: string): UserSession {
    const session: UserSession = {
      phone,
      step: ChatStep.INITIAL,
      lastActive: new Date()
    };
    this.sessions.set(phone, session);
    return session;
  }
}

export const sessionService = new SessionService();
