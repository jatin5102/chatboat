import { prisma } from "../config/prisma.config.js";

export interface ChannelPartnerData {
    id: string;
    fullName: string;
    firmName: string;
    reraNumber: string;
    mobileNo: string;
    emailAddress?: string | null;
    location?: string | null;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class ChannelPartnerService {
    /**
     * Retrieves all active channel partners or filters by search
     */
    public async getAll(search?: string): Promise<ChannelPartnerData[]> {
        const where: any = {};
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: "insensitive" } },
                { firmName: { contains: search, mode: "insensitive" } },
                { reraNumber: { contains: search, mode: "insensitive" } },
                { mobileNo: { contains: search, mode: "insensitive" } },
            ];
        }

        return prisma.channelPartner.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
    }

    public async getById(id: string): Promise<ChannelPartnerData | null> {
        return prisma.channelPartner.findUnique({
            where: { id },
        });
    }

    public async findByRera(reraNumber: string): Promise<ChannelPartnerData | null> {
        const cleanRera = reraNumber.trim();
        return prisma.channelPartner.findUnique({
            where: { reraNumber: cleanRera },
        });
    }

    public async findByPhone(phone: string): Promise<ChannelPartnerData | null> {
        const digits = phone.replace(/\D/g, "");
        return prisma.channelPartner.findFirst({
            where: {
                mobileNo: { contains: digits.slice(-10) },
            },
        });
    }

    public async create(data: {
        fullName: string;
        firmName: string;
        reraNumber: string;
        mobileNo: string;
        emailAddress?: string;
        location?: string;
        status?: boolean;
    }): Promise<ChannelPartnerData> {
        return prisma.channelPartner.create({
            data: {
                fullName: data.fullName.trim(),
                firmName: data.firmName.trim(),
                reraNumber: data.reraNumber.trim(),
                mobileNo: data.mobileNo.trim(),
                emailAddress: data.emailAddress || null,
                location: data.location || "Noida",
                status: data.status !== undefined ? data.status : true,
            },
        });
    }

    public async update(
        id: string,
        data: Partial<{
            fullName: string;
            firmName: string;
            reraNumber: string;
            mobileNo: string;
            emailAddress: string;
            location: string;
            status: boolean;
        }>,
    ): Promise<ChannelPartnerData> {
        return prisma.channelPartner.update({
            where: { id },
            data,
        });
    }

    public async delete(id: string): Promise<ChannelPartnerData> {
        return prisma.channelPartner.delete({
            where: { id },
        });
    }

    /**
     * Upsert helper for bot chat registration: finds by RERA or creates new
     */
    public async upsertFromBot(data: {
        fullName: string;
        firmName: string;
        reraNumber: string;
        mobileNo: string;
    }): Promise<ChannelPartnerData> {
        const cleanRera = data.reraNumber.trim();
        const existing = await prisma.channelPartner.findUnique({
            where: { reraNumber: cleanRera },
        });

        if (existing) {
            return prisma.channelPartner.update({
                where: { id: existing.id },
                data: {
                    fullName: data.fullName.trim(),
                    firmName: data.firmName.trim(),
                    mobileNo: data.mobileNo.trim(),
                },
            });
        }

        return prisma.channelPartner.create({
            data: {
                fullName: data.fullName.trim(),
                firmName: data.firmName.trim(),
                reraNumber: cleanRera,
                mobileNo: data.mobileNo.trim(),
                location: "Noida / NCR",
                status: true,
            },
        });
    }
}

export const channelPartnerService = new ChannelPartnerService();
