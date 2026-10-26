import z from "zod";

export const createChannelPartnerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full Name is required"),
    firmName: z.string().min(2, "Company/Firm Name is required"),
    reraNumber: z.string().min(2, "RERA Number is required"),
    mobileNo: z.string().min(10, "Valid Mobile Number is required"),
    emailAddress: z.string().email("Invalid email").optional().or(z.literal("")),
    location: z.string().optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  }),
});

export const updateChannelPartnerSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
    firmName: z.string().optional(),
    reraNumber: z.string().optional(),
    mobileNo: z.string().optional(),
    emailAddress: z.string().email("Invalid email").optional().or(z.literal("")),
    location: z.string().optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  }),
});
