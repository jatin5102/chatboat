import z from "zod";

export const createChannelPartnerSchema = z.object({
    body: z.object({
        fullName: z.string().min(2, "Full Name is required"),
        firmName: z.string().optional(),
        reraNumber: z.string().optional(),
        mobileNo: z.string().optional(),
        status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
    }),
});

export const updateChannelPartnerSchema = z.object({
    body: z.object({
        fullName: z.string().optional(),
        firmName: z.string().optional(),
        reraNumber: z.string().optional(),
        mobileNo: z.string().optional(),
        emailAddress: z.string().optional(),
        location: z.string().optional(),
        status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
    }),
});
