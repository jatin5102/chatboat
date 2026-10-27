import { prisma } from "../../config/prisma.config.js";
import { ICreateProject, IUpdateProject } from "./project.interface.js";
import { paginate, PaginationParams } from "../../utils/pagination.utils.js";

export const getList = async (platterId?: string, pagination?: PaginationParams) => {
  const where: any = {
    status: true,
  };
  if (platterId) {
    where.platterId = platterId;
  }

  const queryArgs = {
    where,
    include: {
      platter: true,
    },
    orderBy: { seq: "asc" as const },
  };

  if (pagination && (pagination.page !== undefined || pagination.limit !== undefined)) {
    return paginate(prisma.projects, queryArgs, {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    });
  }

  return prisma.projects.findMany(queryArgs);
};

export const getById = async (idOrSlug: string) => {
  return prisma.projects.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      platter: true,
    },
  });
};

export const create = async (data: ICreateProject) => {
  const slug =
    data.slug ||
    data.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const project = await prisma.projects.create({
    data: {
      projectName: data.projectName,
      slug,
      platterId: data.platterId || null,
      location: data.location || null,
      shortDescription: data.shortDescription || null,
      tagline: data.tagline || null,
      priceRange: data.priceRange || null,
      price: data.price || null,
      brochure: data.brochure || null,
      seq: data.seq ?? 0,
      status: data.status !== undefined ? data.status : true,
      hasDocuments: !!data.brochure,
    },
    include: {
      platter: true,
    },
  });

  return project;
};

export const update = async (id: string, data: IUpdateProject) => {
  return prisma.projects.update({
    where: { id },
    data,
    include: {
      platter: true,
    },
  });
};

export const destroy = async (id: string) => {
  return prisma.projects.delete({
    where: { id },
  });
};

export const setDocuments = async (
  projectId: string,
  data: {
    brochure?: string;
    hasDocuments?: boolean;
    documents?: Array<{
      title: string;
      link: string;
      fileType?: any;
      alt?: string;
      seq?: number;
    }>;
  }
) => {
  const updateData: any = {};
  if (data.brochure !== undefined) {
    updateData.brochure = data.brochure;
    updateData.hasDocuments =
      data.hasDocuments !== undefined ? data.hasDocuments : !!data.brochure;
  } else if (data.hasDocuments !== undefined) {
    updateData.hasDocuments = data.hasDocuments;
  }

  return prisma.projects.update({
    where: { id: projectId },
    data: updateData,
    include: {
      platter: true,
    },
  });
};
