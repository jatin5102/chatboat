import { Router } from "express";
import { PlatterRoutes } from "./platter/platter.route.js";
import { ChannelPartnerRoutes } from "./channelPartner/channelPartner.route.js";
import { ProjectRoutes } from "./projects/project.route.js";
import { ChatbotRoutes } from "./chatbot/chatbot.route.js";
import { CollateralRoutes } from "./collateral/collateral.route.js";

const router = Router();

// Modular Routes
router.use("/platters", PlatterRoutes);
router.use("/channel-partners", ChannelPartnerRoutes);
router.use("/projects", ProjectRoutes);
router.use("/chatbot", ChatbotRoutes);
router.use("/collaterals", CollateralRoutes);

export default router;
