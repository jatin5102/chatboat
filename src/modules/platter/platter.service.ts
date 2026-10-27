import { prisma } from "../../config/prisma.config.js";
import { ICreatePlatter, IUpdatePlatter } from "./platter.interface.js";
import { paginate, PaginationParams } from "../../utils/pagination.utils.js";

export const getList = async (
  options: { onlyActive?: boolean } & PaginationParams = { onlyActive: true }
) => {
  const { onlyActive = true, page, limit } = options;
  const where: any = onlyActive ? { status: true } : {};

  const queryArgs = {
    where,
    orderBy: { seq: "asc" as const },
    include: {
      collaterals: {
        where: { status: true },
        orderBy: { seq: "asc" as const },
      },
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
        orderBy: { seq: "asc" as const },
      },
      _count: {
        select: { projects: true, collaterals: true },
      },
    },
  };

  if (page !== undefined || limit !== undefined) {
    return paginate(prisma.platter, queryArgs, { page: page || 1, limit: limit || 10 });
  }

  return prisma.platter.findMany(queryArgs);
};

export const getById = async (idOrSlug: string) => {
  return prisma.platter.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      collaterals: {
        where: { status: true },
        orderBy: { seq: "asc" },
      },
      projects: {
        where: { status: true },
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
  const updateData = { ...data };

  if (updateData.name && !updateData.slug) {
    updateData.slug = updateData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  return prisma.platter.update({
    where: { id },
    data: updateData,
  });
};

export const destroy = async (id: string) => {
  return prisma.platter.delete({
    where: { id },
  });
};
