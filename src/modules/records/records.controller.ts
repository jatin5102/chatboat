import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../../config/prisma.config.js";
import { getFileUrl } from "../../utils/fileHandling.utils.js";

/**
 * Get all chat sessions stored in database
 */
export const getSessions = asyncHandler(async (_req: Request, res: Response) => {
    const sessions = await prisma.chatbotSession.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
            _count: { select: { messages: true } },
        },
    });
    res.json({ success: true, count: sessions.length, data: sessions });
});

/**
 * Full chat flow history for a given chatId or sessionId
 */
export const getMessagesByChatId = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.chatId);
    const messages = await prisma.chatbotMessage.findMany({
        where: {
            OR: [{ chatId: id }, { sessionId: id }],
        },
        orderBy: { createdAt: "asc" },
    });

    const transformedMessages = await Promise.all(
        messages.map(async (msg) => {
            const mediaUrl = msg.mediaUrl
                ? (await getFileUrl(msg.mediaUrl)) || msg.mediaUrl
                : msg.mediaUrl;

            let message = msg.message;
            const isFileMessage =
                Boolean(message) &&
                (message!.startsWith("/uploads/") ||
                    message!.startsWith("uploads/") ||
                    (msg.mediaType !== "text" &&
                        /\.(png|jpe?g|gif|webp|svg|ico|pdf|mp4|mov|avi|mkv)$/i.test(
                            message!.trim(),
                        )) ||
                    (msg.mediaUrl && message === msg.mediaUrl));

            if (isFileMessage) {
                message = (await getFileUrl(message)) || message;
            }

            return {
                ...msg,
                message,
                mediaUrl,
            };
        }),
    );

    res.json({ success: true, count: transformedMessages.length, data: transformedMessages });
});

/**
 * Update session step
 */
export const updateSessionStep = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { step } = req.body;
    const session = await prisma.chatbotSession.update({
        where: { id },
        data: { step, lastActive: new Date() },
    });
    res.json({ success: true, data: session });
});

/**
 * Get captured enquiries / leads
 */
export const getEnquiries = asyncHandler(async (_req: Request, res: Response) => {
    const buyerEnquiries = await prisma.projectEnquiry.findMany({
        orderBy: { dateAt: "desc" },
        take: 50,
    });
    const partnerEnquiries = await prisma.channelPartnerEnquiry.findMany({
        orderBy: { dateAt: "desc" },
        take: 50,
    });
    res.json({
        success: true,
        buyers: buyerEnquiries,
        channelPartners: partnerEnquiries,
    });
});

