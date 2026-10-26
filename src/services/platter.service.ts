import { prisma } from "../config/prisma.config.js";

export interface PlatterWithProjects {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  seq: number;
  status: boolean;
  projects?: any[];
  _count?: { projects: number };
}

export class PlatterService {
  public async getAllPlatters(onlyActive: boolean = true): Promise<PlatterWithProjects[]> {
    const where: any = onlyActive ? { status: true } : {};
    return prisma.platter.findMany({
      where,
      orderBy: { seq: "asc" },
      include: {
        projects: {
          where: { status: true },
          select: {
            id: true,
            slug: true,
            projectName: true,
            location: true,
            tagline: true,
            priceRange: true,
            brochure: true,
            seq: true,
          },
          orderBy: { seq: "asc" },
        },
        _count: {
          select: { projects: true },
        },
      },
    });
  }

  public async getPlatterById(id: string): Promise<PlatterWithProjects | null> {
    return prisma.platter.findUnique({
      where: { id },
      include: {
        projects: {
          where: { status: true },
          include: {
            projectGallery: true,
            projectReras: true,
            projectAmenities: true,
          },
          orderBy: { seq: "asc" },
        },
      },
    });
  }

  public async getPlatterBySlug(slug: string): Promise<PlatterWithProjects | null> {
    return prisma.platter.findUnique({
      where: { slug },
      include: {
        projects: {
          where: { status: true },
          include: {
            projectGallery: true,
            projectReras: true,
          },
          orderBy: { seq: "asc" },
        },
      },
    });
  }

  public async createPlatter(data: {
    name: string;
    slug?: string;
    tagline?: string;
    description?: string;
    seq?: number;
    status?: boolean;
  }): Promise<PlatterWithProjects> {
    const slug =
      data.slug ||
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    return prisma.platter.create({
      data: {
        name: data.name,
        slug,
        tagline: data.tagline || null,
        description: data.description || null,
        seq: data.seq ?? 0,
        status: data.status !== undefined ? data.status : true,
      },
    });
  }

  public async updatePlatter(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      tagline: string;
      description: string;
      seq: number;
      status: boolean;
    }>
  ): Promise<PlatterWithProjects> {
    return prisma.platter.update({
      where: { id },
      data,
    });
  }

  public async deletePlatter(id: string): Promise<PlatterWithProjects> {
    return prisma.platter.delete({
      where: { id },
    });
  }
}

export const platterService = new PlatterService();
