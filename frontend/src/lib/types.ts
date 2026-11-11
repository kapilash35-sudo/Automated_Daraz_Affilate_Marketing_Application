export type GroupRole = 'SOURCE' | 'DESTINATION' | 'NONE';
export type ChannelType = 'NEWS' | 'DARAZ';
export type GroupLanguage = 'TAMIL' | 'SINHALA' | 'ALL';
export type PostStatus =
  | 'PENDING'
  | 'PENDING_APPROVAL'
  | 'PROCESSING'
  | 'SENT'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'FAILED';

export interface WhatsAppGroup {
  id: string;
  wahaChatId: string;
  name: string;
  role: GroupRole;
  type: ChannelType;
  language: GroupLanguage;
  isActive: boolean;
  createdAt: string;
}

export interface WhatsAppSessionStatus {
  connected: boolean;
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
  session: string;
  me?: {
    id: string;
    pushName?: string;
  } | null;
}

export interface WhatsAppQRResponse {
  status: string;
  connected: boolean;
  session?: string;
  qr: string | null;
  timestamp: string;
}

export interface SystemSettings {
  adminPhone: string;
  communityInviteUrl: string;
  autoApprove: string;
  conversionRate: string;
  avgCommission: string;
  wahaSessionName?: string;
}

export interface DealPost {
  id: string;
  sourceRef: string | null;
  type: ChannelType;
  rawPayload: any;
  processedText: string | null;
  processedTextSinhala?: string | null;
  mediaUrl: string | null;
  status: PostStatus;
  sentAt: string | null;
  clicksCount: number;
  reactionsCount: number;
  createdAt: string;
  destinationGroup?: WhatsAppGroup | null;
}

export interface DarazAnalyticsResponse {
  success: boolean;
  summary: {
    totalDeals: number;
    totalSent: number;
    totalClicks: number;
    conversionRatePercent: string;
    avgCommissionPerOrder: number;
    expectedOrders: number;
    expectedCommission: number;
  };
  heatmap: {
    grid: number[][];
    maxValue: number;
    topPeakSlots: Array<{ day: number; hour: number; count: number }>;
  };
  topProducts: Array<{
    id: string;
    title: string;
    originalPrice?: number | string;
    discountPrice: number | string;
    discountPercentage?: number | string;
    commissionAmount?: number;
    clicksCount: number;
    estimatedRevenue: number;
    mediaUrl: string | null;
    sentAt: string | null;
  }>;
  liveDeals: Array<{
    id: string;
    title: string;
    status: PostStatus;
    clicksCount: number;
    createdAt: string;
    sentAt: string | null;
  }>;
}
