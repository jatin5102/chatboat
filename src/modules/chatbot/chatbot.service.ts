import QRCode from "qrcode";

export type WhatsAppConnectionStatus =
  | "INITIALIZING"
  | "WAITING_QR"
  | "AUTHENTICATING"
  | "AUTHENTICATED"
  | "READY"
  | "DISCONNECTED"
  | "AUTH_FAILURE";

class ChatbotConnectionManager {
  private status: WhatsAppConnectionStatus = "INITIALIZING";
  private rawQr: string | null = null;
  private qrDataUrl: string | null = null;
  private qrGeneratedAt: Date | null = null;
  private isReady: boolean = false;

  public setInitializing(): void {
    this.status = "INITIALIZING";
    this.isReady = false;
    this.rawQr = null;
    this.qrDataUrl = null;
    this.qrGeneratedAt = null;
  }

  public async setQr(qr: string): Promise<void> {
    this.status = "WAITING_QR";
    this.rawQr = qr;
    this.qrGeneratedAt = new Date();
    this.isReady = false;
    try {
      this.qrDataUrl = await QRCode.toDataURL(qr, {
        width: 380,
        margin: 2,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
    } catch (err) {
      console.error("[ChatbotService] Failed to render QR to DataURL:", err);
    }
  }

  public setAuthenticated(): void {
    this.status = "AUTHENTICATED";
    this.rawQr = null;
    this.qrDataUrl = null;
  }

  public setReady(): void {
    this.status = "READY";
    this.isReady = true;
    this.rawQr = null;
    this.qrDataUrl = null;
  }

  public setAuthFailure(msg?: string): void {
    this.status = "AUTH_FAILURE";
    this.isReady = false;
    this.rawQr = null;
    this.qrDataUrl = null;
  }

  public setDisconnected(): void {
    this.status = "DISCONNECTED";
    this.isReady = false;
  }

  public getStatus() {
    return {
      status: this.status,
      isReady: this.isReady,
      qrAvailable: !!this.qrDataUrl,
      qrGeneratedAt: this.qrGeneratedAt,
      uptime: process.uptime(),
    };
  }

  public getQrData() {
    return {
      status: this.status,
      isReady: this.isReady,
      qr: this.rawQr,
      qrImage: this.qrDataUrl,
      generatedAt: this.qrGeneratedAt,
    };
  }
}

export const chatbotConnectionManager = new ChatbotConnectionManager();
