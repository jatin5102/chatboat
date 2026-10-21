export type UserRole = 'BUYER' | 'CHANNEL_PARTNER';

export enum ChatStep {
  INITIAL = 'INITIAL',
  AWAITING_NAME = 'AWAITING_NAME',
  AWAITING_LOCATION = 'AWAITING_LOCATION',
  AWAITING_ROLE = 'AWAITING_ROLE',
  AWAITING_RERA = 'AWAITING_RERA',
  AWAITING_PROPERTY_SELECTION = 'AWAITING_PROPERTY_SELECTION',
  PROPERTY_MENU = 'PROPERTY_MENU'
}

export interface UserSession {
  chatId: string;
  phone: string;
  name?: string;
  location?: string;
  role?: UserRole;
  reraNumber?: string;
  step: ChatStep;
  selectedPropertyId?: string;
  lastActive: Date;
}

export interface Property {
  id: string;
  name: string;
  tagline: string;
  location: string;
  priceRange: string;
  reraNumber: string;
  description: string;
  amenities: string[];
  brochurePath: string;
  imagePaths: string[];
}
