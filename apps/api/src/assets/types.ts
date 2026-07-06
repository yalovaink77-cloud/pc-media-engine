/**
 * Asset Library DTOs — Sprint 39.
 */

export type AssetDimensions = {
  width?: number;
  height?: number;
};

export type AssetThumbnail = {
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
  /** Relative API path when thumbnail file exists. */
  url?: string;
};

export type AssetListItem = {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  dimensions?: AssetDimensions;
  thumbnail?: AssetThumbnail;
  publisherCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProcessingTimelineEntry = {
  id: string;
  processingType: string;
  status: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  createdAt: string;
};

export type PublishingHistorySummaryItem = {
  id: string;
  publisher: string;
  status: string;
  url: string;
  slug: string;
  publishedAt: string;
};

export type AssetDetail = AssetListItem & {
  originalFilename: string;
  storageKey: string;
  storageProvider: string;
  altText?: string;
  tags: string[];
  checksum?: string;
  processingTimeline: ProcessingTimelineEntry[];
  publishingHistory: PublishingHistorySummaryItem[];
  publishingSummary: {
    total: number;
    publishers: Array<{ publisher: string; count: number }>;
  };
  downloadUrl?: string;
  metadata: Record<string, Record<string, unknown>>;
};

export type AssetListQuery = {
  projectId: string;
  status?: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
};

export type AssetListResult = {
  assets: AssetListItem[];
  total: number;
  limit: number;
  offset: number;
};

export const ASSET_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export function isAssetStatus(value: string): value is AssetStatus {
  return (ASSET_STATUSES as readonly string[]).includes(value);
}

export const DEFAULT_ASSET_LIMIT = 50;
export const MAX_ASSET_LIMIT = 200;

export interface AssetLibraryService {
  listAssets(query: AssetListQuery): Promise<AssetListResult>;
  getAsset(projectId: string, assetId: string): Promise<AssetDetail | null>;
  getAssetStorageKey(projectId: string, assetId: string): Promise<string | null>;
  getThumbnailStorageKey(projectId: string, assetId: string): Promise<string | null>;
}
