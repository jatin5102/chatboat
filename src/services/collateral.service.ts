import { prisma } from "../config/prisma.config.js";
import { FileType } from "../generated/prisma/enums.js";

export interface CollateralItem {
  id: string;
  projectId?: string | null;
  code: string;
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  fileType: FileType;
  fileUrl?: string | null;
  content?: string | null;
  seq: number;
  status: boolean;
}

export class CollateralService {
  /**
   * Ensure default master collaterals exist in database.
   */
  public async ensureDefaultCollaterals(): Promise<void> {
    const count = await prisma.projectCollateral.count();
    if (count === 0) {
      await prisma.projectCollateral.createMany({
        data: [
          {
            code: "BROCHURE",
            title: "Official PDF Brochure",
            subtitle: "(Personalized with your Name, Firm & RERA)",
            icon: "📄",
            fileType: FileType.document,
            seq: 1,
            status: true,
          },
          {
            code: "GALLERY",
            title: "High-Res 3D Creatives & Gallery",
            subtitle: "(Watermarked with your Firm Details)",
            icon: "🖼️",
            fileType: FileType.image,
            seq: 2,
            status: true,
          },
          {
            code: "FACTSHEET",
            title: "Project Factsheet & Specifications",
            subtitle: "(Amenities, Layouts & Pricing)",
            icon: "📑",
            fileType: FileType.document,
            seq: 3,
            status: true,
          },
          {
            code: "FLOOR_PLAN",
            title: "Master Layout & Floor Plans",
            subtitle: "(Unit configurations & tower maps)",
            icon: "📐",
            fileType: FileType.document,
            seq: 4,
            status: true,
          },
          {
            code: "PAYMENT_PLAN",
            title: "Payment Plan & Commercial Terms",
            subtitle: "(Construction linked & flexible plans)",
            icon: "💰",
            fileType: FileType.document,
            seq: 5,
            status: true,
          },
          {
            code: "LOCATION_MAP",
            title: "Location Map & Connectivity",
            subtitle: "(Expressway & Metro proximity highlights)",
            icon: "🗺️",
            fileType: FileType.image,
            seq: 6,
            status: true,
          },
        ],
      });
      console.log("✅ Seeded default marketing collaterals into ProjectCollateral table.");
    }
  }

  /**
   * Get active collaterals for a given project (status: true).
   * Checks for project-specific active collaterals first; falls back to global/master active collaterals.
   */
  public async getActiveCollateralsForProject(projectId?: string): Promise<CollateralItem[]> {
    await this.ensureDefaultCollaterals();

    // 1. Check if there are project-specific collaterals
    if (projectId) {
      const projectSpecific = await prisma.projectCollateral.findMany({
        where: {
          projectId,
          status: true,
        },
        orderBy: { seq: "asc" },
      });

      if (projectSpecific.length > 0) {
        return projectSpecific;
      }
    }

    // 2. Fall back to global master active collaterals (where projectId is null)
    const masterCollaterals = await prisma.projectCollateral.findMany({
      where: {
        projectId: null,
        status: true,
      },
      orderBy: { seq: "asc" },
    });

    return masterCollaterals;
  }

  /**
   * List all collaterals with optional filters.
   */
  public async getAllCollaterals(filter?: {
    projectId?: string;
    status?: boolean;
    code?: string;
  }): Promise<CollateralItem[]> {
    await this.ensureDefaultCollaterals();

    const where: any = {};
    if (filter?.projectId !== undefined) {
      where.projectId = filter.projectId === "null" ? null : filter.projectId;
    }
    if (filter?.status !== undefined) {
      where.status = filter.status;
    }
    if (filter?.code) {
      where.code = filter.code;
    }

    return prisma.projectCollateral.findMany({
      where,
      orderBy: [{ projectId: "asc" }, { seq: "asc" }],
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            slug: true,
          },
        },
      },
    }) as any;
  }

  /**
   * Get a single collateral by ID.
   */
  public async getCollateralById(id: string): Promise<CollateralItem | null> {
    return prisma.projectCollateral.findUnique({
      where: { id },
      include: {
        project: true,
      },
    }) as any;
  }

  /**
   * Create a new collateral item.
   */
  public async createCollateral(data: {
    projectId?: string | null;
    code?: string;
    title: string;
    subtitle?: string;
    icon?: string;
    fileType?: FileType;
    fileUrl?: string;
    content?: string;
    seq?: number;
    status?: boolean;
  }): Promise<CollateralItem> {
    return prisma.projectCollateral.create({
      data: {
        projectId: data.projectId || null,
        code: (data.code || "CUSTOM").toUpperCase(),
        title: data.title,
        subtitle: data.subtitle || null,
        icon: data.icon || "📄",
        fileType: data.fileType || FileType.document,
        fileUrl: data.fileUrl || null,
        content: data.content || null,
        seq: data.seq ?? 0,
        status: data.status !== undefined ? data.status : true,
      },
    });
  }

  /**
   * Update an existing collateral.
   */
  public async updateCollateral(
    id: string,
    data: {
      projectId?: string | null;
      code?: string;
      title?: string;
      subtitle?: string;
      icon?: string;
      fileType?: FileType;
      fileUrl?: string;
      content?: string;
      seq?: number;
      status?: boolean;
    }
  ): Promise<CollateralItem> {
    return prisma.projectCollateral.update({
      where: { id },
      data: {
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.title && { title: data.title }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.fileType && { fileType: data.fileType }),
        ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.seq !== undefined && { seq: data.seq }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  }

  /**
   * Toggle status between active (true) and inactive (false).
   */
  public async toggleStatus(id: string, status?: boolean): Promise<CollateralItem> {
    if (status !== undefined) {
      return prisma.projectCollateral.update({
        where: { id },
        data: { status },
      });
    }

    const current = await prisma.projectCollateral.findUnique({
      where: { id },
      select: { status: true },
    });

    return prisma.projectCollateral.update({
      where: { id },
      data: { status: !current?.status },
    });
  }

  /**
   * Delete a collateral.
   */
  public async deleteCollateral(id: string): Promise<CollateralItem> {
    return prisma.projectCollateral.delete({
      where: { id },
    });
  }
}

export const collateralService = new CollateralService();
