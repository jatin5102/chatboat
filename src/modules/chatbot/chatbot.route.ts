import { Router } from "express";
import * as chatbotCtrl from "./chatbot.controller.js";

const router = Router();

// GET status of WhatsApp chatbot connection
router.get("/status", chatbotCtrl.getStatus);

// GET QR Code (JSON with raw QR and base64 PNG data URL)
router.get("/qr", chatbotCtrl.getQr);

// GET Web HTML View for scanning QR directly in browser
router.get("/qr-view", chatbotCtrl.getQrView);

// POST Restart WhatsApp connection to get fresh QR
router.post("/restart", chatbotCtrl.restart);

export { router as ChatbotRoutes };
