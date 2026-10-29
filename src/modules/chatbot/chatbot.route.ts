import { Router } from "express";
import * as chatbotCtrl from "./chatbot.controller.js";

const router = Router();

router.get("/status", chatbotCtrl.getStatus);
router.get("/qr", chatbotCtrl.getQr);
router.get("/qr-view", chatbotCtrl.getQrView);
router.post("/restart", chatbotCtrl.restart);
router.post("/send", chatbotCtrl.sendMessage);

export { router as ChatbotRoutes };
