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
export const getAllMessages = asyncHandler(async (_req: Request, res: Response) => {
    const messages = await prisma.chatbotMessage.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
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
 * Delete session
 */
export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.chatbotSession.delete({ where: { id } });
    res.json({ success: true, message: "Session deleted successfully" });
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

/**
 * Delete project enquiry
 */
export const deleteProjectEnquiry = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.projectEnquiry.delete({ where: { id } });
    res.json({ success: true, message: "Enquiry deleted successfully" });
});

/**
 * Toggle channel partner enquiry status
 */
export const toggleChannelPartnerEnquiryStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const enquiry = await prisma.channelPartnerEnquiry.findUnique({ where: { id } });
    if (!enquiry) {
        res.status(404).json({ success: false, message: "Enquiry not found" });
        return;
    }
    const updated = await prisma.channelPartnerEnquiry.update({
        where: { id },
        data: { status: !enquiry.status },
    });
    res.json({ success: true, data: updated });
});

/**
 * Delete channel partner enquiry
 */
export const deleteChannelPartnerEnquiry = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.channelPartnerEnquiry.delete({ where: { id } });
    res.json({ success: true, message: "Channel partner enquiry deleted successfully" });
});

/**
 * Get users / admin team from database
 */
export const getUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
    });
    const transformed = users.map((u) => ({
        ...u,
        name: u.name || "Admin",
        status: "active",
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
    }));
    res.json({ success: true, count: transformed.length, data: transformed });
});

/**
 * Update user
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { name, role, email } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (email !== undefined) updateData.email = email;

    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    res.json({
        success: true,
        data: {
            ...user,
            name: user.name || "Admin",
            status: "active",
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
        },
    });
});

/**
 * Delete user
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User deleted successfully" });
});
