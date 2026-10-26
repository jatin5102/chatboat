import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { chatbotConnectionManager } from "./chatbot.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { restartWhatsApp } from "../../app.js";

export const getStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = chatbotConnectionManager.getStatus();
  successResponse(res, 200, "WhatsApp bot status fetched successfully", status);
});

export const getQr = asyncHandler(async (_req: Request, res: Response) => {
  const qrData = chatbotConnectionManager.getQrData();
  successResponse(res, 200, "WhatsApp connection QR data fetched successfully", qrData);
});

export const getQrView = asyncHandler(async (_req: Request, res: Response) => {
  const qrData = chatbotConnectionManager.getQrData();
  const status = chatbotConnectionManager.getStatus();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect WhatsApp Chatbot - QR Code</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0b1120;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    .badge.ready { background: #065f46; color: #34d399; }
    .badge.waiting { background: #854d0e; color: #fde047; }
    .badge.init { background: #1e3a8a; color: #93c5fd; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #ffffff; }
    p.subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 0 auto 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .qr-container img { display: block; max-width: 280px; width: 100%; height: auto; border-radius: 8px; }
    .connected-box {
      padding: 40px 20px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid #10b981;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .connected-box h2 { color: #34d399; font-size: 20px; margin-bottom: 8px; }
    .steps {
      text-align: left;
      background: #0f172a;
      padding: 16px 20px;
      border-radius: 10px;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.7;
      margin-bottom: 20px;
    }
    .steps ol { padding-left: 20px; }
    .steps li { margin-bottom: 4px; }
    .btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .footer-note { font-size: 12px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    ${
      status.isReady
        ? `<span class="badge ready">● ONLINE & CONNECTED</span>`
        : qrData.qrImage
        ? `<span class="badge waiting">⏳ SCAN QR CODE TO CONNECT</span>`
        : `<span class="badge init">⚙️ INITIALIZING WHATSAPP...</span>`
    }
    <h1>M3M Noida Chatbot</h1>
    <p class="subtitle">Connect your WhatsApp to activate the Channel Partner automated collateral bot.</p>

    ${
      status.isReady
        ? `
        <div class="connected-box">
          <h2>🎉 WhatsApp Bot is Connected!</h2>
          <p style="color: #cbd5e1; font-size: 14px;">The chatbot is online and actively handling partner requests.</p>
        </div>
        `
        : qrData.qrImage
        ? `
        <div class="qr-container">
          <img src="${qrData.qrImage}" alt="Scan WhatsApp QR Code" />
        </div>
        <div class="steps">
          <ol>
            <li>Open <strong>WhatsApp</strong> on your phone</li>
            <li>Tap <strong>Menu (⋮)</strong> or <strong>Settings</strong></li>
            <li>Select <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></li>
            <li>Point your camera at this QR code to connect</li>
          </ol>
        </div>
        `
        : `
        <div style="padding: 40px 20px; background: #0f172a; border-radius: 12px; margin-bottom: 20px;">
          <p style="color: #94a3b8; font-size: 14px;">Generating fresh QR code from WhatsApp Web engine...</p>
        </div>
        `
    }

    <div>
      <button class="btn" onclick="location.reload()">🔄 Refresh Status</button>
    </div>

    <p class="footer-note">Auto-checking connection status every 4 seconds.</p>
  </div>

  <script>
    // Auto-refresh poll every 4 seconds until connected
    setInterval(async () => {
      try {
        const statusUrl = window.location.pathname.includes('/v1/') ? '/api/v1/chatbot/status' : '/api/chatbot/status';
        const res = await fetch(statusUrl);
        const json = await res.json();
        const currentReady = ${status.isReady};
        if (json.data && json.data.isReady !== currentReady) {
          location.reload();
        }
      } catch (e) {}
    }, 4000);
  </script>
</body>
</html>
  `;

  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export const restart = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await restartWhatsApp();
    successResponse(res, 200, "WhatsApp client restart initiated successfully. Fresh QR code is generating.", {
      restarted: true,
      status: "INITIALIZING"
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});
