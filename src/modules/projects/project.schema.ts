import z from "zod";

export const createProjectSchema = z.object({
  body: z.object({
    projectName: z.string().min(2, "Project Name is required"),
    slug: z.string().optional(),
    platterId: z.string().optional(),
    location: z.string().optional(),
    shortDescription: z.string().optional(),
    tagline: z.string().optional(),
    priceRange: z.string().optional(),
    price: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    brochure: z.string().optional(),
    seq: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
    reraNumber: z.string().optional(),
    amenities: z.array(z.string()).optional(),
  }),
});

export const updateProjectSchema = z.object({
  body: z.object({
    projectName: z.string().optional(),
    slug: z.string().optional(),
    platterId: z.string().optional(),
    location: z.string().optional(),
    shortDescription: z.string().optional(),
    tagline: z.string().optional(),
    priceRange: z.string().optional(),
    price: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    brochure: z.string().optional(),
    seq: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    status: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
  }),
});

export const createGallerySchema = z.object({
  body: z.object({
    title: z.string().optional(),
    fileType: z.enum(["image", "video", "link", "document"]).optional(),
    link: z.string().min(1, "Media link/path is required"),
    alt: z.string().optional(),
    seq: z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  }),
});
