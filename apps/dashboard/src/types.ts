/**
 * Response shapes that mirror the Sprint 27 dashboard API endpoints.
 * Kept local to avoid a hard dependency on @pcme/api at runtime.
 */

export type DashboardHealthData = {
  status: 'ok';
  database: 'ok' | 'unavailable' | 'skipped';
  publishing: {
    publisherDriver: string;
    queueEnabled: boolean;
    retryConfig: { maxRetries: number; backoffMs: number };
  };
  version: string;
  env: string;
};

export type PublisherCount = {
  publisher: string;
  count: number;
};

export type DashboardSummaryData = {
  totalPublished: number;
  totalDrafts: number;
  totalFailed: number;
  latestPublishedAt: string | null;
  publishers: PublisherCount[];
  duplicateDetectionEnabled: boolean;
  schedulerEnabled: boolean;
  retryEnabled: boolean;
  aiProvider: string;
  publisherDriver: string;
};

export type RecentItem = {
  id: string;
  projectId: string;
  assetId: string;
  publisher: string;
  externalId: string;
  url: string;
  status: string;
  publishedAt: string;
  createdAt: string;
};

export type DashboardRecentData = {
  items: RecentItem[];
  count: number;
};

export type DashboardMetricsData = {
  uploadsTotal: number;
  processedTotal: number;
  publishedTotal: number;
  retriesTotal: number;
  failuresTotal: number;
  duplicateSkipsTotal: number;
  schedulerJobsTotal: number;
  queueWaiting: number;
  queueActive: number;
  queueCompleted: number;
  queueFailed: number;
  collectedAt: string;
};

/** Queue status — mirrors GET /queue/status response (Sprint 32). */
export type DashboardQueueData = {
  paused: boolean;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
};

/** All data fetched for one page render. */
export type DashboardPageData = {
  health: DashboardHealthData | null;
  summary: DashboardSummaryData | null;
  recent: DashboardRecentData | null;
  /** ISO string; set at the time the server handles the request. */
  fetchedAt: string;
  metrics: DashboardMetricsData | null;
  /** Queue operational status (Sprint 32). */
  queueStatus: DashboardQueueData | null;
  /** One or more user-visible error messages when any fetch failed. */
  errors: string[];
  /** Flash message after a queue operation (Sprint 36). */
  flash?: DashboardFlash;
  /** Whether DASHBOARD_API_KEY is configured (Sprint 36). */
  apiKeyConfigured: boolean;
};

/** Result message shown after a queue operation redirect. */
export type DashboardFlash = {
  message: string;
  type: 'ok' | 'err';
};

/** Result of a queue management API call. */
export type QueueActionResult = {
  ok: boolean;
  status: number;
  message: string;
};

// ---------------------------------------------------------------------------
// Publisher management (Sprint 37)
// ---------------------------------------------------------------------------

export type PublisherCapabilities = {
  mediaUpload: boolean;
  postCreation: boolean;
  drafts: boolean;
  tags: boolean;
  categories: boolean;
  featuredImages: boolean;
  scheduling: boolean;
  update: boolean;
  delete: boolean;
};

export type ConfigRequirement = {
  envVar: string;
  required: boolean;
  description: string;
};

export type PublisherListItem = {
  id: string;
  displayName: string;
  version: string;
  enabled: boolean;
  capabilities: PublisherCapabilities;
  supportsHealthCheck: boolean;
};

export type PublisherDetail = PublisherListItem & {
  description: string;
  homepageUrl?: string;
  configurationRequirements: ConfigRequirement[];
};

export type PublisherHealthResult = {
  healthy: boolean;
  latency: number;
  message: string;
};

export type PublishersPageData = {
  publishers: PublisherListItem[];
  details: Record<string, PublisherDetail | null>;
  fetchedAt: string;
  errors: string[];
  flash?: DashboardFlash;
};

// ---------------------------------------------------------------------------
// Publishing jobs (Sprint 38)
// ---------------------------------------------------------------------------

export type JobPayloadSummary = {
  title: string;
  slug: string;
  organizationId?: string;
  projectId?: string;
  assetId?: string;
  processingJobId?: string;
  scheduledFor?: string;
  mediaMimeType?: string;
  mediaFilename?: string;
  hasMedia: boolean;
};

export type JobListItem = {
  id: string;
  name: string;
  status: string;
  publisher: string;
  projectId?: string;
  assetId?: string;
  title: string;
  slug: string;
  retryCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt?: string;
  scheduledFor?: string;
};

export type JobRetryAttempt = {
  attempt: number;
  error?: string;
};

export type JobDetail = JobListItem & {
  payload: JobPayloadSummary;
  queueState: string;
  scheduledTime?: string;
  processedAt?: string;
  finishedAt?: string;
  delayMs?: number;
  error?: { message?: string; stacktrace?: string[] };
  retryHistory: JobRetryAttempt[];
  queuePaused: boolean;
};

export type JobListResult = {
  jobs: JobListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type JobListFilters = {
  status?: string;
  publisher?: string;
  projectId?: string;
  assetId?: string;
  limit?: number;
  offset?: number;
};

export type JobsPageData = {
  result: JobListResult | null;
  filters: JobListFilters;
  fetchedAt: string;
  errors: string[];
  flash?: DashboardFlash;
  apiKeyConfigured: boolean;
};

export type JobDetailPageData = {
  job: JobDetail | null;
  fetchedAt: string;
  errors: string[];
  flash?: DashboardFlash;
  apiKeyConfigured: boolean;
};

// ---------------------------------------------------------------------------
// Asset library (Sprint 39)
// ---------------------------------------------------------------------------

export type AssetDimensions = { width?: number; height?: number };

export type AssetThumbnail = {
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
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

export type AssetListResult = {
  assets: AssetListItem[];
  total: number;
  limit: number;
  offset: number;
};

export type AssetListFilters = {
  projectId?: string;
  status?: string;
  mimeType?: string;
  limit?: number;
  offset?: number;
};

export type AssetsPageData = {
  result: AssetListResult | null;
  filters: AssetListFilters;
  fetchedAt: string;
  errors: string[];
  apiBaseUrl: string;
};

export type AssetDetailPageData = {
  asset: AssetDetail | null;
  fetchedAt: string;
  errors: string[];
  apiBaseUrl: string;
};

// ---------------------------------------------------------------------------
// Content composer (Sprint 40)
// ---------------------------------------------------------------------------

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

export type ComposerSeoMetadata = {
  slug: string;
  seoTitle: string;
  excerpt: string;
  metaDescription: string;
  readingTimeMinutes: number;
  tags: string[];
  categories: string[];
};

export type ComposerAiMetadata = {
  provider: string;
  aiApplied: boolean;
  message?: string;
};

export type ComposerReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

export type ComposerPublisherCompatibility = {
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
  dimensions?: AssetDimensions;
  thumbnail?: AssetThumbnail;
  tags: string[];
  altText?: string;
  seo: ComposerSeoMetadata;
  ai: ComposerAiMetadata;
  readiness: ComposerReadiness;
  validationWarnings: string[];
  compatiblePublishers: ComposerPublisherCompatibility[];
  publishingHistory: PublishingHistorySummaryItem[];
  publishingSummary: {
    total: number;
    publishers: Array<{ publisher: string; count: number }>;
  };
  preview: { title: string; slug: string; body: string };
};

export type ComposerAssetListResult = {
  assets: ComposerAssetListItem[];
  total: number;
  limit: number;
  offset: number;
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

export type ComposerPublishResult = {
  assetId: string;
  accepted: Array<{ publisherId: string; jobId: string }>;
  skipped: Array<{ publisherId: string; reason: string }>;
  failures: Array<{ publisherId: string; reason: string }>;
};

export type ComposerPageData = {
  assets: ComposerAssetListResult | null;
  selectedAsset: ComposerAssetDetail | null;
  selectedAssetId?: string;
  selectedPublisherIds?: string[];
  publishResult: ComposerPublishResult | null;
  confirmPublish?: boolean;
  fetchedAt: string;
  errors: string[];
  apiBaseUrl: string;
};
