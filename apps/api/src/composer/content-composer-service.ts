import { basename, extname } from 'node:path';

import { createAiMetadataEnrichmentService } from '@pcme/ai';
import type { StorageProvider } from '@pcme/media';
import type { PublisherCapabilities } from '@pcme/publisher-sdk';
import type { PublishMetadata } from '@pcme/seo';

import type { AssetLibraryService, AssetListItem } from '../assets/types.js';
import type { PublisherManagementService } from '../publishers/types.js';
import type { PublishingQueueEnqueuer } from '../queue/publishing-enqueue.js';
import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { encodeMediaBuffer } from '../queue/publishing-payload.js';
import type {
  ComposerAssetDetail,
  ComposerAssetListItem,
  ComposerAssetListQuery,
  ComposerAssetListResult,
  ComposerBulkPublishInput,
  ComposerBulkPublishResult,
  ComposerBulkPublishSummary,
  ComposerPublishInput,
  ComposerPublishResult,
  ComposerScheduleInput,
  ComposerScheduleResult,
  ComposerValidateInput,
  ComposerValidateResult,
  ContentComposerService,
  PublisherCompatibility,
  PublishingReadiness,
} from './types.js';
import {
  DEFAULT_COMPOSER_LIMIT,
  MAX_BULK_ASSETS,
  MAX_BULK_PUBLISHERS,
  MAX_COMPOSER_LIMIT,
} from './types.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ContentComposerDeps = {
  assetLibrary: AssetLibraryService;
  publisherService?: PublisherManagementService;
  findDuplicate?: (projectId: string, publisher: string, slug: string) => Promise<boolean>;
  publishingEnqueuer?: PublishingQueueEnqueuer;
  storageProvider?: Pick<StorageProvider, 'get' | 'exists'>;
  defaultOrganizationId?: string;
  env?: Record<string, string | undefined>;
};

function titleFromFilename(filename: string): string {
  const ext = extname(filename);
  const base = basename(filename, ext) || 'media';
  return base.replace(/[-_]/g, ' ').trim() || 'media';
}

function isEligibleForPublishing(status: string): boolean {
  return status === 'ready';
}

function toListItem(asset: AssetListItem): ComposerAssetListItem {
  const ready = isEligibleForPublishing(asset.status);
  return {
    id: asset.id,
    projectId: asset.projectId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    status: asset.status,
    readiness: ready ? 'ready' : 'not_ready',
    thumbnail: asset.thumbnail,
    publisherCount: asset.publisherCount,
    createdAt: asset.createdAt,
  };
}

function assessReadiness(status: string, hasThumbnail: boolean, slug: string): PublishingReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (status !== 'ready') {
    blockers.push(`Asset status is "${status}" — must be "ready" before publishing`);
  }
  if (!hasThumbnail) {
    warnings.push('No thumbnail artifact found — featured image may be unavailable');
  }
  if (!SLUG_PATTERN.test(slug)) {
    blockers.push(`Generated slug "${slug}" is not URL-safe`);
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}

function publisherGaps(
  caps: PublisherCapabilities,
  metadata: PublishMetadata,
  hasThumbnail: boolean,
): string[] {
  const gaps: string[] = [];
  if (!caps.postCreation) gaps.push('Provider does not support post creation');
  if (!caps.mediaUpload && !caps.featuredImages) {
    gaps.push('Provider does not support media or featured images');
  }
  if (caps.featuredImages && !hasThumbnail) {
    gaps.push('Featured images supported but asset has no thumbnail');
  }
  if (caps.tags && metadata.tags.length === 0) {
    gaps.push('Provider supports tags but none are set');
  }
  if (caps.categories && metadata.categories.length === 0) {
    gaps.push('Provider supports categories but none are set');
  }
  return gaps;
}

function buildCompatiblePublishers(
  publisherService: PublisherManagementService | undefined,
  metadata: PublishMetadata,
  hasThumbnail: boolean,
): PublisherCompatibility[] {
  if (!publisherService) return [];

  return publisherService.listPublishers().map((publisher) => {
    const gaps = publisherGaps(publisher.capabilities, metadata, hasThumbnail);
    if (!publisher.enabled) {
      gaps.unshift('Publisher is not enabled — required configuration is missing');
    }
    const compatible = publisher.enabled && !gaps.some((g) => g.startsWith('Provider does not'));
    return {
      id: publisher.id,
      displayName: publisher.displayName,
      enabled: publisher.enabled,
      compatible,
      gaps,
    };
  });
}

function missingConfigRequirements(
  publisherService: PublisherManagementService | undefined,
  publisherId: string,
  env: Record<string, string | undefined>,
): string[] {
  if (!publisherService) return ['Publisher service unavailable'];
  const detail = publisherService.getPublisher(publisherId);
  if (!detail) return [`Publisher "${publisherId}" is not registered`];

  const missing: string[] = [];
  for (const req of detail.configurationRequirements) {
    if (!req.required) continue;
    const value = env[req.envVar]?.trim();
    if (!value) missing.push(`${req.envVar}: ${req.description}`);
  }
  if (!detail.enabled && missing.length === 0) {
    missing.push('Publisher is disabled — required configuration is missing');
  }
  return missing;
}

const THUMBNAIL_MIME = 'image/webp';

async function loadThumbnailMedia(
  deps: ContentComposerDeps,
  projectId: string,
  assetId: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const storageKey = await deps.assetLibrary.getThumbnailStorageKey(projectId, assetId);
  if (!storageKey || !deps.storageProvider) return null;

  try {
    const exists = await deps.storageProvider.exists(storageKey);
    if (!exists) return null;
    const buffer = await deps.storageProvider.get(storageKey);
    const filename = storageKey.split('/').pop() ?? `${assetId}_thumb.webp`;
    return { buffer, mimeType: THUMBNAIL_MIME, filename };
  } catch {
    return null;
  }
}

function buildPublishingPayload(
  detail: ComposerAssetDetail,
  publisherId: string,
  media: { buffer: Buffer; mimeType: string; filename: string },
  organizationId?: string,
  scheduledFor?: string,
): PublishingJobPayload {
  return {
    title: detail.preview.title,
    slug: detail.preview.slug,
    body: detail.preview.body,
    organizationId,
    projectId: detail.projectId,
    assetId: detail.id,
    publisherId,
    mediaMimeType: media.mimeType,
    mediaFilename: media.filename,
    mediaBuffer: encodeMediaBuffer(media.buffer),
    ...(scheduledFor ? { scheduledFor } : {}),
  };
}

function validateScheduledFor(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'scheduledFor is required';
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return 'scheduledFor must be a valid ISO 8601 datetime';
  if (ms <= Date.now()) return 'scheduledFor must be in the future';
  return null;
}

export function createContentComposerService(deps: ContentComposerDeps): ContentComposerService {
  const env = deps.env ?? process.env;
  const aiService = createAiMetadataEnrichmentService({ env });

  async function buildMetadata(
    filename: string,
    dimensions?: { width?: number; height?: number },
    tags?: string[],
  ): Promise<{ metadata: PublishMetadata; ai: ComposerAssetDetail['ai'] }> {
    const title = titleFromFilename(filename);
    const body = `<p>Publish-ready content for ${title}.</p>`;
    const result = await aiService.enrich({
      title,
      body,
      tags,
      image: dimensions
        ? { width: dimensions.width, height: dimensions.height, mimeType: 'image/webp' }
        : undefined,
    });
    return {
      metadata: result.metadata,
      ai: {
        provider: result.provider,
        aiApplied: result.aiApplied,
        message: result.message,
      },
    };
  }

  return {
    async listEligibleAssets(query: ComposerAssetListQuery): Promise<ComposerAssetListResult> {
      const limit = Math.min(
        Math.max(query.limit ?? DEFAULT_COMPOSER_LIMIT, 1),
        MAX_COMPOSER_LIMIT,
      );
      const offset = Math.max(query.offset ?? 0, 0);

      const result = await deps.assetLibrary.listAssets({
        projectId: query.projectId,
        status: 'ready',
        limit,
        offset,
      });

      return {
        assets: result.assets.map(toListItem),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      };
    },

    async getComposerAsset(
      projectId: string,
      assetId: string,
    ): Promise<ComposerAssetDetail | null> {
      const asset = await deps.assetLibrary.getAsset(projectId, assetId);
      if (!asset) return null;

      const title = titleFromFilename(asset.filename);
      const body = `<p>Publish-ready content for ${title}.</p>`;
      const hasThumbnail = Boolean(asset.thumbnail?.url || asset.thumbnail?.storageKey);

      const { metadata, ai } = await buildMetadata(asset.filename, asset.dimensions, asset.tags);

      const readiness = assessReadiness(asset.status, hasThumbnail, metadata.slug);
      const compatiblePublishers = buildCompatiblePublishers(
        deps.publisherService,
        metadata,
        hasThumbnail,
      );

      const validationWarnings = [...readiness.warnings];
      if (asset.status !== 'ready') {
        validationWarnings.push(`Asset is not publish-ready (status: ${asset.status})`);
      }

      return {
        id: asset.id,
        projectId: asset.projectId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        status: asset.status,
        dimensions: asset.dimensions,
        thumbnail: asset.thumbnail,
        tags: asset.tags,
        altText: asset.altText,
        seo: metadata,
        ai,
        readiness,
        validationWarnings,
        compatiblePublishers,
        publishingHistory: asset.publishingHistory,
        publishingSummary: asset.publishingSummary,
        preview: { title: metadata.seoTitle, slug: metadata.slug, body },
      };
    },

    async validate(input: ComposerValidateInput): Promise<ComposerValidateResult> {
      const detail = await this.getComposerAsset(input.projectId, input.assetId);
      if (!detail) {
        return {
          ready: false,
          messages: [`Asset "${input.assetId}" not found`],
          warnings: [],
          publisherCompatibility: {
            publisherId: input.publisherId,
            compatible: false,
            gaps: ['Asset not found'],
          },
          missingRequirements: [],
        };
      }

      const messages: string[] = [...detail.readiness.blockers];
      const warnings: string[] = [...detail.readiness.warnings];
      const missingRequirements = missingConfigRequirements(
        deps.publisherService,
        input.publisherId,
        env,
      );

      const publisher = deps.publisherService?.getPublisher(input.publisherId);
      const gaps: string[] = [];

      if (!publisher) {
        messages.push(`Publisher "${input.publisherId}" is not registered`);
        gaps.push('Publisher not registered');
      } else {
        gaps.push(...publisherGaps(publisher.capabilities, detail.seo, Boolean(detail.thumbnail)));
        if (!publisher.enabled) {
          messages.push('Publisher is not enabled');
        }
        if (!publisher.capabilities.postCreation) {
          messages.push('Publisher does not support post creation');
        }
      }

      if (missingRequirements.length > 0) {
        messages.push(...missingRequirements.map((r) => `Missing: ${r}`));
      }

      if (deps.findDuplicate) {
        const duplicate = await deps.findDuplicate(
          input.projectId,
          input.publisherId,
          detail.seo.slug,
        );
        if (duplicate) {
          warnings.push(
            `Content with slug "${detail.seo.slug}" was already published to ${input.publisherId}`,
          );
        }
      }

      const compatible =
        messages.length === 0 &&
        gaps.filter((g) => g.startsWith('Provider does not')).length === 0 &&
        missingRequirements.length === 0;

      return {
        ready: compatible,
        messages,
        warnings,
        publisherCompatibility: {
          publisherId: input.publisherId,
          compatible,
          gaps,
        },
        missingRequirements,
      };
    },

    async publish(input: ComposerPublishInput): Promise<ComposerPublishResult> {
      const result: ComposerPublishResult = {
        assetId: input.assetId,
        accepted: [],
        skipped: [],
        failures: [],
      };

      if (!deps.publishingEnqueuer) {
        result.failures.push({
          publisherId: '*',
          reason: 'Publishing queue is not available (Redis not configured)',
        });
        return result;
      }

      const detail = await this.getComposerAsset(input.projectId, input.assetId);
      if (!detail) {
        result.failures.push({ publisherId: '*', reason: `Asset "${input.assetId}" not found` });
        return result;
      }

      const uniquePublisherIds = [
        ...new Set(input.publisherIds.map((id) => id.trim()).filter(Boolean)),
      ];
      if (!uniquePublisherIds.length) {
        result.failures.push({ publisherId: '*', reason: 'At least one publisherId is required' });
        return result;
      }

      const media = await loadThumbnailMedia(deps, input.projectId, input.assetId);
      if (!media) {
        result.failures.push({
          publisherId: '*',
          reason: 'Thumbnail media unavailable — cannot build publishing payload',
        });
        return result;
      }

      for (const publisherId of uniquePublisherIds) {
        const validation = await this.validate({
          projectId: input.projectId,
          assetId: input.assetId,
          publisherId,
        });

        if (!validation.ready) {
          result.failures.push({
            publisherId,
            reason: validation.messages.join('; ') || 'Validation failed',
          });
          continue;
        }

        if (deps.findDuplicate) {
          const duplicate = await deps.findDuplicate(input.projectId, publisherId, detail.seo.slug);
          if (duplicate) {
            result.skipped.push({
              publisherId,
              reason: `Duplicate slug "${detail.seo.slug}" already published to ${publisherId}`,
            });
            continue;
          }
        }

        try {
          const payload = buildPublishingPayload(
            detail,
            publisherId,
            media,
            deps.defaultOrganizationId,
          );
          const jobId = await deps.publishingEnqueuer.enqueue(payload);
          result.accepted.push({ publisherId, jobId });
        } catch (err) {
          result.failures.push({
            publisherId,
            reason: err instanceof Error ? err.message : 'Enqueue failed',
          });
        }
      }

      return result;
    },

    async schedule(input: ComposerScheduleInput): Promise<ComposerScheduleResult> {
      const scheduleError = validateScheduledFor(input.scheduledFor);
      const result: ComposerScheduleResult = {
        assetId: input.assetId,
        scheduledFor: input.scheduledFor.trim(),
        accepted: [],
        skipped: [],
        failures: [],
      };

      if (scheduleError) {
        result.failures.push({ publisherId: '*', reason: scheduleError });
        return result;
      }

      if (!deps.publishingEnqueuer) {
        result.failures.push({
          publisherId: '*',
          reason: 'Publishing queue is not available (Redis not configured)',
        });
        return result;
      }

      const detail = await this.getComposerAsset(input.projectId, input.assetId);
      if (!detail) {
        result.failures.push({ publisherId: '*', reason: `Asset "${input.assetId}" not found` });
        return result;
      }

      const uniquePublisherIds = [
        ...new Set(input.publisherIds.map((id) => id.trim()).filter(Boolean)),
      ];
      if (!uniquePublisherIds.length) {
        result.failures.push({ publisherId: '*', reason: 'At least one publisherId is required' });
        return result;
      }

      const media = await loadThumbnailMedia(deps, input.projectId, input.assetId);
      if (!media) {
        result.failures.push({
          publisherId: '*',
          reason: 'Thumbnail media unavailable — cannot build publishing payload',
        });
        return result;
      }

      const scheduledFor = input.scheduledFor.trim();

      for (const publisherId of uniquePublisherIds) {
        const validation = await this.validate({
          projectId: input.projectId,
          assetId: input.assetId,
          publisherId,
        });

        if (!validation.ready) {
          result.failures.push({
            publisherId,
            reason: validation.messages.join('; ') || 'Validation failed',
          });
          continue;
        }

        if (deps.findDuplicate) {
          const duplicate = await deps.findDuplicate(input.projectId, publisherId, detail.seo.slug);
          if (duplicate) {
            result.skipped.push({
              publisherId,
              reason: `Duplicate slug "${detail.seo.slug}" already published to ${publisherId}`,
            });
            continue;
          }
        }

        try {
          const payload = buildPublishingPayload(
            detail,
            publisherId,
            media,
            deps.defaultOrganizationId,
            scheduledFor,
          );
          const jobId = await deps.publishingEnqueuer.enqueue(payload);
          result.accepted.push({ publisherId, jobId });
        } catch (err) {
          result.failures.push({
            publisherId,
            reason: err instanceof Error ? err.message : 'Enqueue failed',
          });
        }
      }

      return result;
    },

    async bulkPublish(input: ComposerBulkPublishInput): Promise<ComposerBulkPublishResult> {
      const accepted: ComposerBulkPublishResult['accepted'] = [];
      const skipped: ComposerBulkPublishResult['skipped'] = [];
      const failures: ComposerBulkPublishResult['failures'] = [];

      const uniqueAssetIds = [...new Set(input.assetIds.map((id) => id.trim()).filter(Boolean))];
      const uniquePublisherIds = [
        ...new Set(input.publisherIds.map((id) => id.trim()).filter(Boolean)),
      ];

      const buildSummary = (): ComposerBulkPublishSummary => ({
        assets: uniqueAssetIds.length,
        publishers: uniquePublisherIds.length,
        pairs: uniqueAssetIds.length * uniquePublisherIds.length,
        accepted: accepted.length,
        skipped: skipped.length,
        failures: failures.length,
      });

      if (!uniqueAssetIds.length) {
        failures.push({
          assetId: '*',
          publisherId: '*',
          reason: 'At least one assetId is required',
        });
        return { accepted, skipped, failures, summary: buildSummary() };
      }
      if (!uniquePublisherIds.length) {
        failures.push({
          assetId: '*',
          publisherId: '*',
          reason: 'At least one publisherId is required',
        });
        return { accepted, skipped, failures, summary: buildSummary() };
      }
      if (uniqueAssetIds.length > MAX_BULK_ASSETS) {
        failures.push({
          assetId: '*',
          publisherId: '*',
          reason: `Maximum ${MAX_BULK_ASSETS} assets per bulk publish request`,
        });
        return { accepted, skipped, failures, summary: buildSummary() };
      }
      if (uniquePublisherIds.length > MAX_BULK_PUBLISHERS) {
        failures.push({
          assetId: '*',
          publisherId: '*',
          reason: `Maximum ${MAX_BULK_PUBLISHERS} publishers per bulk publish request`,
        });
        return { accepted, skipped, failures, summary: buildSummary() };
      }
      if (!deps.publishingEnqueuer) {
        failures.push({
          assetId: '*',
          publisherId: '*',
          reason: 'Publishing queue is not available (Redis not configured)',
        });
        return { accepted, skipped, failures, summary: buildSummary() };
      }

      for (const assetId of uniqueAssetIds) {
        const result = await this.publish({
          projectId: input.projectId,
          assetId,
          publisherIds: uniquePublisherIds,
        });

        for (const item of result.accepted) {
          accepted.push({ assetId, publisherId: item.publisherId, jobId: item.jobId });
        }
        for (const item of result.skipped) {
          skipped.push({ assetId, publisherId: item.publisherId, reason: item.reason });
        }
        for (const item of result.failures) {
          failures.push({ assetId, publisherId: item.publisherId, reason: item.reason });
        }
      }

      return { accepted, skipped, failures, summary: buildSummary() };
    },
  };
}
