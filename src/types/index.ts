export type UserRole = 'BUYER' | 'CHANNEL_PARTNER';

export enum ChatStep {
  INITIAL = 'INITIAL',
  CHOOSE_CHANNEL_PARTNER = 'CHOOSE_CHANNEL_PARTNER',
  AWAITING_NAME = 'AWAITING_NAME',
  AWAITING_RERA = 'AWAITING_RERA',
  AWAITING_FIRM_NAME = 'AWAITING_FIRM_NAME',
  SELECT_PLATTER = 'SELECT_PLATTER',
  SELECT_PROJECT = 'SELECT_PROJECT',
  SELECT_COLLATERAL = 'SELECT_COLLATERAL',
  COLLATERAL_CONFIRMATION = 'COLLATERAL_CONFIRMATION',
  FAQ_MODE = 'FAQ_MODE',
  // Legacy / Buyer steps for compatibility
  AWAITING_LOCATION = 'AWAITING_LOCATION',
  AWAITING_ROLE = 'AWAITING_ROLE',
  AWAITING_PROPERTY_SELECTION = 'AWAITING_PROPERTY_SELECTION',
  PROPERTY_MENU = 'PROPERTY_MENU'
}

export interface UserSession {
  chatId: string;
  phone: string;
  name?: string;
  firmName?: string;
  location?: string;
  role?: UserRole;
  reraNumber?: string;
  selectedPlatterId?: string;
  selectedPropertyId?: string;
  channelPartnerId?: string;
  step: ChatStep;
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
  platterId?: string;
}
