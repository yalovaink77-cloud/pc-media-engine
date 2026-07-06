import type {
  Asset,
  MetadataRecord,
  ProcessingArtifact,
  ProcessingJob,
  PublishedContent,
} from '@pcme/database';
import type { StorageProvider } from '@pcme/media';

import type {
  AssetDetail,
  AssetDimensions,
  AssetLibraryService,
  AssetListItem,
  AssetListQuery,
  AssetListResult,
  AssetThumbnail,
  ProcessingTimelineEntry,
  PublishingHistorySummaryItem,
} from './types.js';
import { DEFAULT_ASSET_LIMIT, MAX_ASSET_LIMIT } from './types.js';

export type AssetLibraryDeps = {
  listAssets: (projectId: string) => Promise<Asset[]>;
  findAsset: (projectId: string, assetId: string) => Promise<Asset | null>;
  findProcessingJobs: (projectId: string, assetId: string) => Promise<ProcessingJob[]>;
  listArtifacts: (projectId: string, assetId: string) => Promise<ProcessingArtifact[]>;
  findDimensions: (projectId: string, assetId: string) => Promise<MetadataRecord[]>;
  findAllMetadata: (projectId: string, assetId: string) => Promise<MetadataRecord[]>;
  findPublished: (projectId: string, assetId: string) => Promise<PublishedContent[]>;
  storageProvider?: Pick<StorageProvider, 'getPublicUrl' | 'exists'>;
};

function parseDimensions(records: MetadataRecord[]): AssetDimensions | undefined {
  const width = records.find((r) => r.key === 'width_px')?.value;
  const height = records.find((r) => r.key === 'height_px')?.value;
  const w = typeof width === 'number' ? width : undefined;
  const h = typeof height === 'number' ? height : undefined;
  if (w === undefined && h === undefined) return undefined;
  return { width: w, height: h };
}

function pickThumbnail(
  artifacts: ProcessingArtifact[],
  assetId: string,
  hasFile: (key: string) => Promise<boolean>,
): Promise<AssetThumbnail | undefined> {
  const thumb = artifacts
    .filter((a) => a.artifactType === 'thumbnail' && a.storageKey)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  if (!thumb?.storageKey) return Promise.resolve(undefined);

  return hasFile(thumb.storageKey).then((exists) => {
    if (!exists) {
      return {
        mimeType: thumb.mimeType,
        sizeBytes: thumb.sizeBytes ?? undefined,
        storageKey: thumb.storageKey ?? undefined,
      };
    }
    return {
      mimeType: thumb.mimeType,
      sizeBytes: thumb.sizeBytes ?? undefined,
      storageKey: thumb.storageKey ?? undefined,
      url: `/assets/${assetId}/thumbnail`,
    };
  });
}

function toTimeline(jobs: ProcessingJob[]): ProcessingTimelineEntry[] {
  return jobs.map((job) => ({
    id: job.id,
    processingType: job.processingType,
    status: job.status,
    retryCount: job.retryCount,
    startedAt: job.startedAt?.toISOString(),
    completedAt: job.completedAt?.toISOString(),
    failureReason: job.failureReason ?? undefined,
    createdAt: job.createdAt.toISOString(),
  }));
}

function toPublishingHistory(records: PublishedContent[]): PublishingHistorySummaryItem[] {
  return records.map((r) => ({
    id: r.id,
    publisher: r.publisher,
    status: r.status,
    url: r.url,
    slug: r.slug,
    publishedAt: r.publishedAt.toISOString(),
  }));
}

function publisherSummary(records: PublishedContent[]) {
  const counts = new Map<string, number>();
  for (const r of records) {
    counts.set(r.publisher, (counts.get(r.publisher) ?? 0) + 1);
  }
  return {
    total: records.length,
    publishers: [...counts.entries()].map(([publisher, count]) => ({ publisher, count })),
  };
}

async function buildListItem(asset: Asset, deps: AssetLibraryDeps): Promise<AssetListItem> {
  const [artifacts, dimensionsRecords, published] = await Promise.all([
    deps.listArtifacts(asset.projectId, asset.id),
    deps.findDimensions(asset.projectId, asset.id),
    deps.findPublished(asset.projectId, asset.id),
  ]);

  const hasFile = async (key: string) => {
    if (!deps.storageProvider) return false;
    try {
      return await deps.storageProvider.exists(key);
    } catch {
      return false;
    }
  };

  const thumbnail = await pickThumbnail(artifacts, asset.id, hasFile);
  const publishers = new Set(published.map((p) => p.publisher));

  return {
    id: asset.id,
    projectId: asset.projectId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    dimensions: parseDimensions(dimensionsRecords),
    thumbnail,
    publisherCount: publishers.size,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function createAssetLibraryService(deps: AssetLibraryDeps): AssetLibraryService {
  const hasFile = async (key: string) => {
    if (!deps.storageProvider) return false;
    try {
      return await deps.storageProvider.exists(key);
    } catch {
      return false;
    }
  };

  return {
    async listAssets(query: AssetListQuery): Promise<AssetListResult> {
      const limit = Math.min(Math.max(query.limit ?? DEFAULT_ASSET_LIMIT, 1), MAX_ASSET_LIMIT);
      const offset = Math.max(query.offset ?? 0, 0);

      let assets = await deps.listAssets(query.projectId);

      if (query.status) {
        assets = assets.filter((a) => a.status === query.status);
      }
      if (query.mimeType) {
        const mime = query.mimeType.toLowerCase();
        assets = assets.filter((a) => a.mimeType.toLowerCase() === mime);
      }

      assets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = assets.length;
      const page = assets.slice(offset, offset + limit);

      const enriched = await Promise.all(page.map((asset) => buildListItem(asset, deps)));

      return { assets: enriched, total, limit, offset };
    },

    async getAsset(projectId: string, assetId: string): Promise<AssetDetail | null> {
      const asset = await deps.findAsset(projectId, assetId);
      if (!asset) return null;

      const [jobs, artifacts, published, allMetadata, base] = await Promise.all([
        deps.findProcessingJobs(projectId, assetId),
        deps.listArtifacts(projectId, assetId),
        deps.findPublished(projectId, assetId),
        deps.findAllMetadata(projectId, assetId),
        buildListItem(asset, deps),
      ]);

      const metadata: Record<string, Record<string, unknown>> = {};
      for (const record of allMetadata) {
        const ns = metadata[record.namespace] ?? {};
        ns[record.key] = record.value as unknown;
        metadata[record.namespace] = ns;
      }

      let downloadUrl: string | undefined;
      if (deps.storageProvider && (await hasFile(asset.storageKey))) {
        downloadUrl = `/assets/${assetId}/download`;
      }

      const thumbnail = await pickThumbnail(artifacts, assetId, hasFile);

      return {
        ...base,
        thumbnail,
        originalFilename: asset.originalFilename,
        storageKey: asset.storageKey,
        storageProvider: asset.storageProvider,
        altText: asset.altText ?? undefined,
        tags: asset.tags,
        checksum: asset.checksum ?? undefined,
        processingTimeline: toTimeline(jobs),
        publishingHistory: toPublishingHistory(published),
        publishingSummary: publisherSummary(published),
        downloadUrl,
        metadata,
      };
    },

    async getAssetStorageKey(projectId: string, assetId: string): Promise<string | null> {
      const asset = await deps.findAsset(projectId, assetId);
      return asset?.storageKey ?? null;
    },

    async getThumbnailStorageKey(projectId: string, assetId: string): Promise<string | null> {
      const artifacts = await deps.listArtifacts(projectId, assetId);
      const thumb = artifacts
        .filter((a) => a.artifactType === 'thumbnail' && a.storageKey)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return thumb?.storageKey ?? null;
    },
  };
}
