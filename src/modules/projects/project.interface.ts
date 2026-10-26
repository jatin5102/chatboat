import { FileType } from "../../generated/prisma/enums.js";

export interface IProject {
  id: string;
  slug: string;
  projectName: string;
  platterId?: string | null;
  location?: string | null;
  shortDescription?: string | null;
  tagline?: string | null;
  priceRange?: string | null;
  price?: number | null;
  brochure?: string | null;
  status: boolean;
  hasDocuments: boolean;
  seq: number;
}

export interface ICreateProject {
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
}

export interface IUpdateProject {
  projectName?: string;
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
}

export interface ICreateGalleryItem {
  title?: string;
  fileType?: FileType;
  link: string;
  alt?: string;
  seq?: number;
}
