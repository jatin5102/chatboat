import path from "node:path";
import fs from "node:fs";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { prisma } from "../config/prisma.config.js";
import { seedProperties } from "../utils/seedProjects.utils.js";
import { FileType } from "../generated/prisma/enums.js";
import { collateralService } from "./collateral.service.js";

export interface BotProject {
  id: string;
  slug: string;
  name: string;
  platterId?: string | null;
  platterName?: string | null;
  tagline: string;
  location: string;
  priceRange: string;
  reraNumber: string;
  description: string;
  amenities: string[];
  brochurePath: string;
  imagePaths: string[];
  galleryItems: Array<{
    id: string;
    title: string | null;
    fileType: string;
    link: string;
  }>;
}

export class ProjectService {
  private rootDir = process.cwd();

  public resolvePath(relativePath?: string | null): string {
    if (!relativePath) return "";
    if (path.isAbsolute(relativePath)) return relativePath;

    const direct = path.resolve(this.rootDir, relativePath);
    if (fs.existsSync(direct)) return direct;

    // Fallback search between assets/ and uploads/
    if (relativePath.startsWith("assets/")) {
      const alt = path.resolve(this.rootDir, relativePath.replace(/^assets\//, "uploads/"));
      if (fs.existsSync(alt)) return alt;
    } else if (relativePath.startsWith("uploads/")) {
      const alt = path.resolve(this.rootDir, relativePath.replace(/^uploads\//, "assets/"));
      if (fs.existsSync(alt)) return alt;
    }

    return direct;
  }

  public async ensureBrochureFile(p: any): Promise<string> {
    if (p.brochure) {
      const resolved = this.resolvePath(p.brochure);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }

    const slug = p.slug || "project";
    const targetPath = path.resolve(this.rootDir, `assets/properties/${slug}/brochure.pdf`);
    if (fs.existsSync(targetPath)) {
      return targetPath;
    }

    // Auto-create brochure PDF if missing
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const pdfDoc = await PDFDocument.create();
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();

      page.drawRectangle({
        x: 30,
        y: height - 130,
        width: width - 60,
        height: 90,
        color: rgb(0.06, 0.12, 0.22),
      });

      page.drawText((p.projectName || "PROJECT").toUpperCase(), {
        x: 50,
        y: height - 85,
        size: 20,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      const locationText = p.location || "Noida, UP";
      const reraText = p.projectReras?.[0]?.reraNumber || "UPRERAPRJ442214";
      page.drawText(`Location: ${locationText} | RERA: ${reraText}`, {
        x: 50,
        y: height - 110,
        size: 11,
        font: fontRegular,
        color: rgb(0.22, 0.74, 0.97),
      });

      page.drawText("EXECUTIVE PROJECT OVERVIEW & SPECIFICATIONS", {
        x: 35,
        y: height - 165,
        size: 13,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.22),
      });

      const desc = p.shortDescription || p.tagline || "Exclusive modern luxury real estate development.";
      page.drawText(desc.slice(0, 95), {
        x: 35,
        y: height - 190,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.35, 0.4),
      });

      const pdfBytes = await pdfDoc.save();
      fs.writeFileSync(targetPath, pdfBytes);

      // Save to uploads as well for consistency
      const uploadsCopy = path.resolve(this.rootDir, `uploads/properties/${slug}/brochure.pdf`);
      fs.mkdirSync(path.dirname(uploadsCopy), { recursive: true });
      fs.writeFileSync(uploadsCopy, pdfBytes);

      if (!p.brochure) {
        await prisma.projects.update({
          where: { id: p.id },
          data: {
            brochure: `assets/properties/${slug}/brochure.pdf`,
            hasDocuments: true,
          },
        });
      }
      return targetPath;
    } catch (err: any) {
      console.warn(`Could not auto-generate brochure for ${p.projectName}:`, err.message);
      return targetPath;
    }
  }

  public async ensureProjectsLoaded(): Promise<void> {
    const platterCount = await prisma.platter.count();
    const projectCount = await prisma.projects.count();
    if (platterCount === 0 || projectCount === 0) {
      console.log("Seeding M3M Noida Platters, Projects, Documents & FAQs...");
      await seedProperties();
    }
    await collateralService.ensureDefaultCollaterals();
  }

  /**
   * Returns projects, optionally filtered by platterId.
   */
  public async getAllProjects(platterId?: string): Promise<BotProject[]> {
    await this.ensureProjectsLoaded();

    const where: any = {
      status: true,
    };
    if (platterId) {
      where.platterId = platterId;
    }

    const dbProjects = await prisma.projects.findMany({
      where,
      include: {
        platter: true,
        projectAmenities: {
          orderBy: { seq: "asc" },
        },
        projectGallery: {
          orderBy: { seq: "asc" },
        },
        projectReras: true,
      },
      orderBy: { seq: "asc" },
    });

    const result: BotProject[] = [];

    for (const p of dbProjects) {
      const otherDetails = (p.otherDetails as any) || {};
      const tagline =
        p.tagline || otherDetails.tagline || p.shortDescription || "Premier Luxury Residences";
      const priceRange =
        p.priceRange ||
        otherDetails.priceRange ||
        (p.price ? `₹${(p.price / 10000000).toFixed(2)} Cr Onwards` : "Price on Request");

      const reraNumber =
        p.projectReras[0]?.reraNumber ||
        otherDetails.reraNumber ||
        "UPRERAPRJ442214";

      const amenities =
        p.projectAmenities.length > 0
          ? p.projectAmenities.map((a) => a.title)
          : ["Gated Community", "Clubhouse & Gym", "24x7 Security", "Landscaped Promenade"];

      const brochurePath = await this.ensureBrochureFile(p);

      const imagePaths = p.projectGallery
        .filter((g) => g.fileType === "image")
        .map((g) => this.resolvePath(g.link))
        .filter((pth) => fs.existsSync(pth));

      const galleryItems = p.projectGallery.map((g) => ({
        id: g.id,
        title: g.title,
        fileType: g.fileType,
        link: this.resolvePath(g.link),
      }));

      result.push({
        id: p.id,
        slug: p.slug,
        name: p.projectName,
        platterId: p.platterId,
        platterName: p.platter?.name || null,
        tagline,
        location: p.location || "Noida, UP",
        priceRange,
        reraNumber,
        description: p.shortDescription || p.projectName,
        amenities,
        brochurePath,
        imagePaths,
        galleryItems,
      });
    }

    return result;
  }

  public async getProjectById(idOrSlug: string): Promise<BotProject | undefined> {
    const all = await this.getAllProjects();
    return all.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
  }

  /**
   * Project CRUD
   */
  public async createProject(data: {
    projectName: string;
    slug?: string;
    platterId?: string;
    location?: string;
    shortDescription?: string;
    tagline?: string;
    priceRange?: string;
    price?: number;
    brochure?: string;
    seq?: number;
    status?: boolean;
    reraNumber?: string;
    amenities?: string[];
  }) {
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
          data: {
            projectId: project.id,
            title,
          },
        });
      }
    }

    return project;
  }

  public async updateProject(
    id: string,
    data: Partial<{
      projectName: string;
      slug: string;
      platterId: string;
      location: string;
      shortDescription: string;
      tagline: string;
      priceRange: string;
      price: number;
      brochure: string;
      seq: number;
      status: boolean;
      hasDocuments: boolean;
    }>
  ) {
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
  }

  public async deleteProject(id: string) {
    return prisma.projects.delete({
      where: { id },
    });
  }

  /**
   * Project Gallery CRUD
   */
  public async getGallery(projectId: string) {
    return prisma.projectGallery.findMany({
      where: { projectId },
      orderBy: { seq: "asc" },
    });
  }

  public async addGalleryItem(
    projectId: string,
    data: {
      title?: string;
      fileType?: FileType;
      link: string;
      alt?: string;
      seq?: number;
    }
  ) {
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
  }

  public async updateGalleryItem(
    id: string,
    data: Partial<{
      title: string;
      fileType: FileType;
      link: string;
      alt: string;
      seq: number;
    }>
  ) {
    return prisma.projectGallery.update({
      where: { id },
      data,
    });
  }

  public async deleteGalleryItem(id: string) {
    return prisma.projectGallery.delete({
      where: { id },
    });
  }
}

export const projectService = new ProjectService();
