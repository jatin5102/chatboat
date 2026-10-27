import { prisma } from "../config/prisma.config.js";
import { FileType } from "../generated/prisma/enums.js";

export interface CollateralItem {
  id: string;
  platterId?: string | null;
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

export const DEFAULT_COLLATERALS = [
  {
    code: "STORY",
    title: "Whatsapp Story",
    subtitle: "(Personalized)",
    icon: "📱",
    fileType: FileType.image,
    seq: 1,
    status: true,
  },
  {
    code: "EDM",
    title: "Whatsapp EDM",
    subtitle: "(Personalized)",
    icon: "✨",
    fileType: FileType.document,
    seq: 2,
    status: true,
  },
  {
    code: "VIDEO",
    title: "Whatsapp Video",
    subtitle: "(Personalized)",
    icon: "🎥",
    fileType: FileType.video,
    seq: 3,
    status: true,
  },
  {
    code: "BROCHURE",
    title: "Brochure",
    subtitle: null,
    icon: "📄",
    fileType: FileType.document,
    seq: 4,
    status: true,
  },
  {
    code: "FLOOR_PLANS",
    title: "Floor Plans",
    subtitle: null,
    icon: "📐",
    fileType: FileType.image,
    seq: 5,
    status: true,
  },
  {
    code: "OPP_DOC",
    title: "Opp Doc",
    subtitle: "(Personalized)",
    icon: "📑",
    fileType: FileType.document,
    seq: 6,
    status: true,
  },
];

export class CollateralService {
  /**
   * Helper to determine appropriate default media files per platter.
   */
  public getDefaultFileForPlatter(platterSlug: string, code: string): string | null {
    const isResidential = (platterSlug || '').toLowerCase().includes('residential');

    switch (code) {
      case 'STORY':
        return isResidential
          ? 'assets/properties/m3m-cullinan/elevation.jpg'
          : 'assets/properties/m3m-the-line/commercial_arcade.jpg';
      case 'EDM':
        return isResidential
          ? 'assets/properties/m3m-cullinan/elevation.jpg'
          : 'assets/properties/m3m-the-line/commercial_arcade.jpg';
      case 'BROCHURE':
        return isResidential
          ? 'assets/properties/m3m-cullinan/brochure.pdf'
          : 'assets/properties/m3m-the-line/brochure.pdf';
      case 'FLOOR_PLANS':
        return isResidential
          ? 'assets/properties/m3m-cullinan/floor_plan.jpg'
          : 'assets/properties/m3m-the-line/floor_plan.jpg';
      case 'OPP_DOC':
        return isResidential
          ? 'assets/properties/m3m-cullinan/opp_doc.pdf'
          : 'assets/properties/m3m-the-line/opp_doc.pdf';
      default:
        return null;
    }
  }

  /**
   * Ensure default master collaterals exist in database.
   */
  public async ensureDefaultCollaterals(): Promise<void> {
    for (const item of DEFAULT_COLLATERALS) {
      const existing = await prisma.projectCollateral.findFirst({
        where: {
          platterId: null,
          projectId: null,
          code: item.code,
        },
      });

      if (!existing) {
        await prisma.projectCollateral.create({
          data: {
            platterId: null,
            projectId: null,
            code: item.code,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            fileType: item.fileType,
            content: null,
            seq: item.seq,
            status: item.status,
          },
        });
      }
    }
  }

  /**
   * Initializes default set of collaterals for a specific platter with attached media files.
   */
  public async ensurePlatterCollaterals(platterId: string): Promise<void> {
    const platter = await prisma.platter.findUnique({ where: { id: platterId } });
    const slug = platter?.slug || '';

    for (const item of DEFAULT_COLLATERALS) {
      const fileUrl = this.getDefaultFileForPlatter(slug, item.code);

      const existing = await prisma.projectCollateral.findFirst({
        where: {
          platterId,
          code: item.code,
        },
      });

      if (!existing) {
        await prisma.projectCollateral.create({
          data: {
            platterId,
            code: item.code,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            fileType: item.fileType,
            fileUrl,
            content: null,
            seq: item.seq,
            status: item.status,
          },
        });
      } else if ((!existing.fileUrl || existing.fileUrl !== fileUrl) && fileUrl) {
        await prisma.projectCollateral.update({
          where: { id: existing.id },
          data: { fileUrl },
        });
      }
    }
  }

  /**
   * Get active collaterals for a given platter (status: true).
   */
  public async getActiveCollateralsForPlatter(platterId?: string): Promise<CollateralItem[]> {
    if (platterId) {
      await this.ensurePlatterCollaterals(platterId);

      const platterCollaterals = await prisma.projectCollateral.findMany({
        where: {
          platterId,
          status: true,
        },
        orderBy: { seq: "asc" },
      });

      if (platterCollaterals.length > 0) {
        return platterCollaterals as CollateralItem[];
      }
    }

    await this.ensureDefaultCollaterals();

    const masterCollaterals = await prisma.projectCollateral.findMany({
      where: {
        platterId: null,
        status: true,
      },
      orderBy: { seq: "asc" },
    });

    return masterCollaterals as CollateralItem[];
  }

  /**
   * Configure specific collaterals active for a platter.
   */
  public async configurePlatterCollaterals(
    platterId: string,
    activeCodes: string[]
  ): Promise<CollateralItem[]> {
    await this.ensurePlatterCollaterals(platterId);

    const upperCodes = activeCodes.map((c) => c.toUpperCase());

    await prisma.projectCollateral.updateMany({
      where: { platterId },
      data: { status: false },
    });

    await prisma.projectCollateral.updateMany({
      where: {
        platterId,
        code: { in: upperCodes },
      },
      data: { status: true },
    });

    return prisma.projectCollateral.findMany({
      where: { platterId },
      orderBy: { seq: "asc" },
    }) as any;
  }

  /**
   * Get active collaterals for a given project (status: true).
   */
  public async getActiveCollateralsForProject(projectId?: string): Promise<CollateralItem[]> {
    if (projectId) {
      const projectCollateralCount = await prisma.projectCollateral.count({
        where: { projectId },
      });

      if (projectCollateralCount > 0) {
        return prisma.projectCollateral.findMany({
          where: {
            projectId,
            status: true,
          },
          orderBy: { seq: "asc" },
        }) as any;
      }
    }

    return this.getActiveCollateralsForPlatter();
  }

  /**
   * Initializes default set of collaterals specifically for a project.
   */
  public async ensureProjectCollaterals(projectId: string): Promise<void> {
    for (const item of DEFAULT_COLLATERALS) {
      const existing = await prisma.projectCollateral.findFirst({
        where: {
          projectId,
          code: item.code,
        },
      });

      if (!existing) {
        await prisma.projectCollateral.create({
          data: {
            projectId,
            code: item.code,
            title: item.title,
            subtitle: item.subtitle,
            icon: item.icon,
            fileType: item.fileType,
            content: null,
            seq: item.seq,
            status: item.status,
          },
        });
      }
    }
  }

  /**
   * Configure specific collaterals active for a project.
   */
  public async configureProjectCollaterals(
    projectId: string,
    activeCodes: string[]
  ): Promise<CollateralItem[]> {
    await this.ensureProjectCollaterals(projectId);

    const upperCodes = activeCodes.map((c) => c.toUpperCase());

    await prisma.projectCollateral.updateMany({
      where: { projectId },
      data: { status: false },
    });

    await prisma.projectCollateral.updateMany({
      where: {
        projectId,
        code: { in: upperCodes },
      },
      data: { status: true },
    });

    return prisma.projectCollateral.findMany({
      where: { projectId },
      orderBy: { seq: "asc" },
    }) as any;
  }

  /**
   * List all collaterals with optional filters.
   */
  public async getAllCollaterals(filter?: {
    platterId?: string;
    projectId?: string;
    status?: boolean;
    code?: string;
  }): Promise<CollateralItem[]> {
    await this.ensureDefaultCollaterals();

    const where: any = {};
    if (filter?.platterId !== undefined) {
      where.platterId = filter.platterId === "null" ? null : filter.platterId;
    }
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
      orderBy: [{ seq: "asc" }],
      include: {
        platter: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
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
        platter: true,
        project: true,
      },
    }) as any;
  }

  /**
   * Create a new collateral item.
   */
  public async createCollateral(data: {
    platterId?: string | null;
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
        platterId: data.platterId || null,
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
      platterId?: string | null;
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
        ...(data.platterId !== undefined && { platterId: data.platterId }),
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
