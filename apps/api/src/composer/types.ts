/**
 * Content Composer DTOs — Sprint 40.
 */

import type { PublishMetadata } from '@pcme/seo';

import type { AssetThumbnail, PublishingHistorySummaryItem } from '../assets/types.js';

export type ComposerAssetListItem = {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  status: string;
  readiness: 'ready' | 'not_ready';
  thumbnail?: AssetThumbnail;
  publisherCount: number;
  createdAt: string;
};

export type ComposerAssetListQuery = {
  projectId: string;
  limit?: number;
  offset?: number;
};

export type ComposerAssetListResult = {
  assets: ComposerAssetListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type PublishingReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

export type AiEnrichmentSummary = {
  provider: string;
  aiApplied: boolean;
  message?: string;
};

export type PublisherCompatibility = {
  id: string;
  displayName: string;
  enabled: boolean;
  compatible: boolean;
  gaps: string[];
};

export type ComposerAssetDetail = {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  dimensions?: { width?: number; height?: number };
  thumbnail?: AssetThumbnail;
  tags: string[];
  altText?: string;
  seo: PublishMetadata;
  ai: AiEnrichmentSummary;
  readiness: PublishingReadiness;
  validationWarnings: string[];
  compatiblePublishers: PublisherCompatibility[];
  publishingHistory: PublishingHistorySummaryItem[];
  publishingSummary: {
    total: number;
    publishers: Array<{ publisher: string; count: number }>;
  };
  preview: {
    title: string;
    slug: string;
    body: string;
  };
};

export type ComposerValidateInput = {
  projectId: string;
  assetId: string;
  publisherId: string;
};

export type ComposerValidateResult = {
  ready: boolean;
  messages: string[];
  warnings: string[];
  publisherCompatibility: {
    publisherId: string;
    compatible: boolean;
    gaps: string[];
  };
  missingRequirements: string[];
};

export type ComposerPublishInput = {
  projectId: string;
  assetId: string;
  publisherIds: string[];
};

export type ComposerPublishAccepted = {
  publisherId: string;
  jobId: string;
};

export type ComposerPublishSkipped = {
  publisherId: string;
  reason: string;
};

export type ComposerPublishFailure = {
  publisherId: string;
  reason: string;
};

export type ComposerPublishResult = {
  assetId: string;
  accepted: ComposerPublishAccepted[];
  skipped: ComposerPublishSkipped[];
  failures: ComposerPublishFailure[];
};

export type ComposerBulkPublishInput = {
  projectId: string;
  assetIds: string[];
  publisherIds: string[];
};

export type ComposerBulkPublishAccepted = {
  assetId: string;
  publisherId: string;
  jobId: string;
};

export type ComposerBulkPublishSkipped = {
  assetId: string;
  publisherId: string;
  reason: string;
};

export type ComposerBulkPublishFailure = {
  assetId: string;
  publisherId: string;
  reason: string;
};

export type ComposerBulkPublishSummary = {
  assets: number;
  publishers: number;
  pairs: number;
  accepted: number;
  skipped: number;
  failures: number;
};

export type ComposerBulkPublishResult = {
  accepted: ComposerBulkPublishAccepted[];
  skipped: ComposerBulkPublishSkipped[];
  failures: ComposerBulkPublishFailure[];
  summary: ComposerBulkPublishSummary;
};

export const DEFAULT_COMPOSER_LIMIT = 50;
export const MAX_COMPOSER_LIMIT = 200;
export const MAX_BULK_ASSETS = 100;
export const MAX_BULK_PUBLISHERS = 20;

export interface ContentComposerService {
  listEligibleAssets(query: ComposerAssetListQuery): Promise<ComposerAssetListResult>;
  getComposerAsset(projectId: string, assetId: string): Promise<ComposerAssetDetail | null>;
  validate(input: ComposerValidateInput): Promise<ComposerValidateResult>;
  publish(input: ComposerPublishInput): Promise<ComposerPublishResult>;
  bulkPublish(input: ComposerBulkPublishInput): Promise<ComposerBulkPublishResult>;
}
