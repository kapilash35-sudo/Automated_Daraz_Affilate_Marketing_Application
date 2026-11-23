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
  communityInviteUrlSinhala?: string;
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

export interface DarazOrderRecord {
  id: string;
  orderId: string;
  subOrderId?: string | null;
  subAffId?: string | null;
  subId?: string | null;
  postId?: string | null;
  language?: string | null;
  itemId?: string | null;
  sku?: string | null;
  itemName?: string | null;
  category1?: string | null;
  category2?: string | null;
  deviceOs?: string | null;
  platform?: string | null;
  isNewUser?: boolean | null;
  commissionRate?: number | null;
  orderAmount: number;
  commissionAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  post?: {
    id: string;
    mediaUrl?: string | null;
    rawPayload?: any;
  } | null;
}

export interface DarazAnalyticsResponse {
  success: boolean;
  summary: {
    totalDeals: number;
    totalSent: number;
    totalClicks: number;
    realOrdersCount?: number;
    realCommissionEarned?: number;
    realSalesVolume?: number;
    conversionRatePercent: string;
    avgCommissionPerOrder: number;
    expectedOrders: number;
    expectedCommission: number;
  };
  recentOrders?: DarazOrderRecord[];
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
    ordersCount?: number;
    actualRevenue?: number;
    actualCommission?: number;
    estimatedRevenue: number;
    mediaUrl: string | null;
    sentAt: string | null;
  }>;
  liveDeals: Array<{
    id: string;
    title: string;
    status: PostStatus;
    clicksCount: number;
    ordersCount?: number;
    actualRevenue?: number;
    actualCommission?: number;
    createdAt: string;
    sentAt: string | null;
  }>;
}
