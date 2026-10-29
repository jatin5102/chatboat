import { prisma } from "../config/prisma.config.js";

export interface FaqItem {
    id: string;
    question: string;
    answer: string;
    category: string | null;
    keywords: string | null;
    seq: number;
    status: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class FaqService {
    /**
     * Retrieves all active FAQs or filter by category / query.
     */
    public async getFaqs(category?: string, search?: string): Promise<FaqItem[]> {
        const where: any = { status: true };
        if (category) {
            where.category = { equals: category, mode: "insensitive" };
        }
        if (search) {
            where.OR = [
                { question: { contains: search, mode: "insensitive" } },
                { answer: { contains: search, mode: "insensitive" } },
                { keywords: { contains: search, mode: "insensitive" } },
            ];
        }

        return prisma.faq.findMany({
            where,
            orderBy: { seq: "asc" },
        });
    }

    /**
     * Get single FAQ by ID
     */
    public async getFaqById(id: string): Promise<FaqItem | null> {
        return prisma.faq.findUnique({
            where: { id },
        });
    }

    /**
     * Create a new FAQ entry
     */
    public async createFaq(data: {
        question: string;
        answer: string;
        category?: string;
        keywords?: string;
        seq?: number;
        status?: boolean;
    }): Promise<FaqItem> {
        return prisma.faq.create({
            data: {
                question: data.question,
                answer: data.answer,
                category: data.category || "General",
                keywords: data.keywords || "",
                seq: data.seq ?? 0,
                status: data.status !== undefined ? data.status : true,
            },
        });
    }

    /**
     * Update an existing FAQ entry
     */
    public async updateFaq(
        id: string,
        data: Partial<{
            question: string;
            answer: string;
            category: string;
            keywords: string;
            seq: number;
            status: boolean;
        }>,
    ): Promise<FaqItem> {
        return prisma.faq.update({
            where: { id },
            data,
        });
    }

    /**
     * Delete an FAQ entry
     */
    public async deleteFaq(id: string): Promise<FaqItem> {
        return prisma.faq.delete({
            where: { id },
        });
    }

    /**
     * Bot search helper: finds the best matching FAQ for user's query text
     */
    public async findBestMatch(userText: string): Promise<FaqItem | null> {
        const cleaned = userText.trim().toLowerCase();
        const faqs = await this.getFaqs();

        // 1. Direct includes in question or keywords
        for (const faq of faqs) {
            const qLower = faq.question.toLowerCase();
            const kwLower = (faq.keywords || "").toLowerCase();
            if (cleaned.includes(qLower) || qLower.includes(cleaned)) {
                return faq;
            }
            if (kwLower) {
                const keywords = kwLower.split(",").map((k) => k.trim());
                if (keywords.some((kw) => kw && cleaned.includes(kw))) {
                    return faq;
                }
            }
        }

        return null;
    }
}

export const faqService = new FaqService();
