import { Router } from "express";
import { PlatterRoutes } from "./platter/platter.route.js";
import { ChannelPartnerRoutes } from "./channelPartner/channelPartner.route.js";
import { ProjectRoutes } from "./projects/project.route.js";
import { ChatbotRoutes } from "./chatbot/chatbot.route.js";
import { CollateralRoutes } from "./collateral/collateral.route.js";
import { UploadRoutes } from "./upload/upload.route.js";
import { FaqRoutes } from "./faq/faq.route.js";
import { RecordsRoutes } from "./records/records.route.js";
import { authRoutes } from "./auth/auth.route.js";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";

const router = Router();

// Modular Routes
router.use("/admin/auth", authRoutes);
router.use("/platters", authenticate, PlatterRoutes);
router.use("/channel-partners", authenticate, ChannelPartnerRoutes);
router.use("/projects", authenticate, ProjectRoutes);
router.use("/chatbot", authenticate, ChatbotRoutes);
router.use("/collaterals", authenticate, CollateralRoutes);
router.use("/upload", authenticate, UploadRoutes);
router.use("/faqs", authenticate, FaqRoutes);
router.use("/records", authenticate, RecordsRoutes);

export default router;
