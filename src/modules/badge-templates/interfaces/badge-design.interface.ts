// Badge element (from custom badge designer)
export interface BadgeElementStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  transform: string;
  rotation: number;
  textTransform?: 'uppercase' | 'none';
  opacity: number;
  zIndex: number;
}

export interface BadgeElement {
  id: string;
  type: 'text' | 'qrcode' | 'image';
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  style: BadgeElementStyle;
  imageId?: string;
  aspectRatio?: number;
  maintainAspectRatio?: boolean;
}

export interface BadgeDesignDimensions {
  width: number;
  height: number;
}

export interface BadgeDesignData {
  dimensions: BadgeDesignDimensions;
  elements: BadgeElement[];
  variables: string[];
  [key: string]: any; // Pour la compatibilité Prisma JSON
}

export interface UploadedImage {
  data: string;
  filename: string;
}

export interface HistoryState {
  elements: BadgeElement[];
  background: string | null;
}

// Badge formats in mm
export const BADGE_FORMATS = {
  LARGE: { width: 96, height: 268, name: '96x268mm' },
  SMALL: { width: 96, height: 164, name: '96x164mm' }
} as const;

export type BadgeFormat = {
  width: number;
  height: number;
  name: string;
};