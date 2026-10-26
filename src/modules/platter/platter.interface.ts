export interface IPlatter {
  id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  seq: number;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreatePlatter {
  name: string;
  slug?: string;
  tagline?: string;
  description?: string;
  seq?: number;
  status?: boolean;
}

export interface IUpdatePlatter {
  name?: string;
  slug?: string;
  tagline?: string;
  description?: string;
  seq?: number;
  status?: boolean;
}
