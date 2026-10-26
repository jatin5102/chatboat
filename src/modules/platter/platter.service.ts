import { prisma } from "../../config/prisma.config.js";
import { ICreatePlatter, IUpdatePlatter } from "./platter.interface.js";

export const getList = async (onlyActive: boolean = true) => {
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
};

export const getById = async (idOrSlug: string) => {
  return prisma.platter.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
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
};

export const create = async (data: ICreatePlatter) => {
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
};

export const update = async (id: string, data: IUpdatePlatter) => {
  return prisma.platter.update({
    where: { id },
    data,
  });
};

export const destroy = async (id: string) => {
  return prisma.platter.delete({
    where: { id },
  });
};
