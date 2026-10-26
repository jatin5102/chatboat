export interface IChannelPartner {
  id: string;
  fullName: string;
  firmName: string;
  reraNumber: string;
  mobileNo: string;
  emailAddress?: string | null;
  location?: string | null;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICreateChannelPartner {
  fullName: string;
  firmName: string;
  reraNumber: string;
  mobileNo: string;
  emailAddress?: string;
  location?: string;
  status?: boolean;
}

export interface IUpdateChannelPartner {
  fullName?: string;
  firmName?: string;
  reraNumber?: string;
  mobileNo?: string;
  emailAddress?: string;
  location?: string;
  status?: boolean;
}
