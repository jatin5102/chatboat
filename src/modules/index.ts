import { Router } from "express";
import { PlatterRoutes } from "./platter/platter.route.js";
import { ChannelPartnerRoutes } from "./channelPartner/channelPartner.route.js";
import { ProjectRoutes } from "./projects/project.route.js";
import { ChatbotRoutes } from "./chatbot/chatbot.route.js";
import { CollateralRoutes } from "./collateral/collateral.route.js";
import { UploadRoutes } from "./upload/upload.route.js";
import { FaqRoutes } from "./faq/faq.route.js";

const router = Router();

// Modular Routes
router.use("/platters", PlatterRoutes);
router.use("/channel-partners", ChannelPartnerRoutes);
router.use("/projects", ProjectRoutes);
router.use("/chatbot", ChatbotRoutes);
router.use("/collaterals", CollateralRoutes);
router.use("/upload", UploadRoutes);
router.use("/faqs", FaqRoutes);

export default router;
