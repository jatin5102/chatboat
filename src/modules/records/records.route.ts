import { Router } from "express";
import {
    getSessions,
    deleteSession,
    getAllMessages,
    getMessagesByChatId,
    updateSessionStep,
    getEnquiries,
    deleteProjectEnquiry,
    toggleChannelPartnerEnquiryStatus,
    deleteChannelPartnerEnquiry,
    getUsers,
    updateUser,
    deleteUser,
} from "./records.controller.js";

const router = Router();

router.get("/sessions", getSessions);
router.delete("/sessions/:id", deleteSession);
router.get("/messages", getAllMessages);
router.get("/messages/:chatId", getMessagesByChatId);
router.patch("/sessions/:id/step", updateSessionStep);
router.get("/enquiries", getEnquiries);
router.delete("/enquiries/project/:id", deleteProjectEnquiry);
router.patch("/enquiries/channel-partner/:id/toggle", toggleChannelPartnerEnquiryStatus);
router.delete("/enquiries/channel-partner/:id", deleteChannelPartnerEnquiry);
router.get("/users", getUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

export const RecordsRoutes = router;
