import { prisma } from "../../config/prisma.config.js";
import { ICreateProject, IUpdateProject, ICreateGalleryItem } from "./project.interface.js";
import { FileType } from "../../generated/prisma/enums.js";

export const getList = async (platterId?: string) => {
  const where: any = {
    status: true,
  };
  if (platterId) {
    where.platterId = platterId;
  }

  return prisma.projects.findMany({
    where,
    include: {
      platter: true,
      projectAmenities: { orderBy: { seq: "asc" } },
      projectGallery: { orderBy: { seq: "asc" } },
      projectReras: true,
    },
    orderBy: { seq: "asc" },
  });
};

export const getById = async (idOrSlug: string) => {
  return prisma.projects.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      platter: true,
      projectAmenities: { orderBy: { seq: "asc" } },
      projectGallery: { orderBy: { seq: "asc" } },
      projectReras: true,
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
  });

  if (data.reraNumber) {
    await prisma.projectRera.create({
      data: {
        projectId: project.id,
        reraNumber: data.reraNumber,
        phase: "Main Phase",
      },
    });
  }

  if (data.amenities && data.amenities.length > 0) {
    for (const title of data.amenities) {
      await prisma.projectAmenities.create({
        data: { projectId: project.id, title },
      });
    }
  }

  return project;
};

export const update = async (id: string, data: IUpdateProject) => {
  return prisma.projects.update({
    where: { id },
    data,
    include: {
      platter: true,
      projectGallery: true,
      projectAmenities: true,
      projectReras: true,
    },
  });
};

export const destroy = async (id: string) => {
  return prisma.projects.delete({
    where: { id },
  });
};

export const getGallery = async (projectId: string) => {
  return prisma.projectGallery.findMany({
    where: { projectId },
    orderBy: { seq: "asc" },
  });
};

export const addGalleryItem = async (projectId: string, data: ICreateGalleryItem) => {
  return prisma.projectGallery.create({
    data: {
      projectId,
      title: data.title || null,
      fileType: data.fileType || FileType.image,
      link: data.link,
      alt: data.alt || null,
      seq: data.seq ?? 0,
    },
  });
};

export const updateGalleryItem = async (
  id: string,
  data: Partial<{ title: string; fileType: FileType; link: string; alt: string; seq: number }>
) => {
  return prisma.projectGallery.update({
    where: { id },
    data,
  });
};

export const deleteGalleryItem = async (id: string) => {
  return prisma.projectGallery.delete({
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
      fileType?: FileType;
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

  // Update project record
  await prisma.projects.update({
    where: { id: projectId },
    data: updateData,
  });

  // If additional documents were provided, add to ProjectGallery
  if (data.documents && data.documents.length > 0) {
    for (const doc of data.documents) {
      await prisma.projectGallery.create({
        data: {
          projectId,
          title: doc.title || "Project Document",
          fileType: doc.fileType || FileType.document,
          link: doc.link,
          alt: doc.alt || null,
          seq: doc.seq ?? 0,
        },
      });
    }
  }

  // Sync ProjectCollateral table if brochure was set
  if (data.brochure) {
    const existingBrochureCollateral = await prisma.projectCollateral.findFirst({
      where: {
        projectId,
        code: "BROCHURE",
      },
    });

    if (existingBrochureCollateral) {
      await prisma.projectCollateral.update({
        where: { id: existingBrochureCollateral.id },
        data: {
          fileUrl: data.brochure,
          status: true,
        },
      });
    } else {
      await prisma.projectCollateral.create({
        data: {
          projectId,
          code: "BROCHURE",
          title: "Official PDF Brochure",
          subtitle: "(Personalized with your Name, Firm & RERA)",
          icon: "📄",
          fileType: FileType.document,
          fileUrl: data.brochure,
          seq: 1,
          status: true,
        },
      });
    }
  }

  return prisma.projects.findUnique({
    where: { id: projectId },
    include: {
      platter: true,
      projectGallery: { orderBy: { seq: "asc" } },
      projectCollaterals: { orderBy: { seq: "asc" } },
      projectAmenities: true,
      projectReras: true,
    },
  });
};
