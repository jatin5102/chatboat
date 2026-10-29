import { Router } from "express";
import {
    getSessions,
    getMessagesByChatId,
    updateSessionStep,
    getEnquiries,
} from "./records.controller.js";

const router = Router();

router.get("/sessions", getSessions);
router.get("/messages/:chatId", getMessagesByChatId);
router.patch("/sessions/:id/step", updateSessionStep);
router.get("/enquiries", getEnquiries);

export const RecordsRoutes = router;

