import z from "zod";

export const createPlatterSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Platter name is required (min 2 chars)"),
    slug: z.string().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    seq: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  }),
});

export const updatePlatterSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    seq: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  }),
});
