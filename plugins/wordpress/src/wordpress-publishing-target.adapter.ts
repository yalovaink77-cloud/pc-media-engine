import type {
  PublishingHandoffPackage,
  PublishingHandoffPublishResult,
  PublishingHandoffWarning,
  PublishingTargetAdapter,
  PublishingTargetCapabilities,
  PublishingValidationResult,
} from '@pcme/publishing';

import { buildBasicAuth } from './auth.js';
import { parseWordPressErrorResponse } from './errors.js';
import type { WordPressHandoffAdapterConfig } from './handoff-config.js';
import { loadWordPressHandoffAdapterConfig } from './handoff-config.js';
import {
  buildSafeHandoffLogMeta,
  mapWordPressHandoffError,
  redactWordPressSecrets,
} from './handoff-errors.js';
import { InMemoryWordPressHandoffIdempotencyStore } from './handoff-idempotency.js';
import {
  buildHandoffPublishRequestSummary,
  convertHandoffContent,
  mapHandoffToWordPressPost,
} from './handoff-mapper.js';
import type { WordPressPublisherLogger } from './logger.js';
import { noopLogger } from './logger.js';
import type { FetchFunction } from './wordpress-media.publisher.js';

export interface WordPressPublishingTargetAdapterOptions {
  readonly fetchFn?: FetchFunction;
  readonly logger?: WordPressPublisherLogger;
  readonly forceDraft?: boolean;
  readonly idempotencyStore?: InMemoryWordPressHandoffIdempotencyStore;
}

type WpPostResponse = {
  id?: number;
  link?: string;
  date?: string;
  status?: string;
  permalink?: string;
};

function buildIssue(
  code: string,
  message: string,
  severity: PublishingHandoffWarning['severity'],
): PublishingHandoffWarning {
  return Object.freeze({ code, message, severity });
}

/** WordPress publishing target adapter for approved handoff packages. */
export class WordPressPublishingTargetAdapter implements PublishingTargetAdapter {
  readonly targetId = 'wordpress';
  readonly capabilities: PublishingTargetCapabilities = Object.freeze({
    supportedFormats: Object.freeze(['markdown', 'plain-text', 'html']),
    supportsDrafts: true,
    supportsScheduling: true,
    supportsFeaturedImage: true,
  });

  private readonly fetchFn: FetchFunction;
  private readonly logger: WordPressPublisherLogger;
  private readonly idempotencyStore: InMemoryWordPressHandoffIdempotencyStore;
  private readonly forceDraft: boolean;

  constructor(
    private readonly config: WordPressHandoffAdapterConfig,
    options: WordPressPublishingTargetAdapterOptions = {},
  ) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.logger = options.logger ?? noopLogger;
    this.idempotencyStore =
      options.idempotencyStore ?? new InMemoryWordPressHandoffIdempotencyStore();
    this.forceDraft = options.forceDraft ?? false;
  }

  validate(pkg: PublishingHandoffPackage): PublishingValidationResult {
    const errors: PublishingHandoffWarning[] = [];
    const warnings: PublishingHandoffWarning[] = [...pkg.warnings];

    if (pkg.status !== 'ready') {
      errors.push(
        buildIssue(
          'handoff-not-ready',
          `Handoff status ${pkg.status} is not ready for publishing`,
          'error',
        ),
      );
    }

    if (pkg.target.targetId !== this.targetId && pkg.target.platform !== 'wordpress') {
      errors.push(
        buildIssue(
          'unsupported-target',
          `Target ${pkg.target.targetId} is not supported by the WordPress adapter`,
          'error',
        ),
      );
    }

    const formatSupported =
      this.capabilities.supportedFormats.includes(pkg.format) ||
      (pkg.format === 'markdown' && this.capabilities.supportedFormats.includes('markdown'));

    if (!formatSupported) {
      errors.push(
        buildIssue(
          'unsupported-format',
          `WordPress adapter does not support format ${pkg.format}`,
          'error',
        ),
      );
    } else if (pkg.format === 'markdown') {
      convertHandoffContent(pkg.format, pkg.content);
    }

    if (
      pkg.publishingMetadata.publishStatus === 'scheduled' &&
      !this.capabilities.supportsScheduling
    ) {
      errors.push(
        buildIssue(
          'scheduling-unsupported',
          'WordPress adapter scheduling is unavailable',
          'error',
        ),
      );
    }

    if (
      pkg.publishingMetadata.publishStatus === 'scheduled' &&
      !pkg.publishingMetadata.scheduledAt
    ) {
      errors.push(
        buildIssue('missing-scheduled-at', 'Scheduled publish requires scheduledAt', 'error'),
      );
    }

    if (pkg.publishingMetadata.featuredImageRef && !this.capabilities.supportsFeaturedImage) {
      errors.push(
        buildIssue(
          'featured-image-unsupported',
          'WordPress adapter does not support featured images',
          'error',
        ),
      );
    }

    if (
      pkg.reviewSummary.status !== 'approved' &&
      pkg.reviewSummary.status !== 'approved-with-notes'
    ) {
      errors.push(
        buildIssue(
          'review-not-approved',
          `Review status ${pkg.reviewSummary.status} cannot be published`,
          'error',
        ),
      );
    }

    const valid = errors.length === 0;
    return Object.freeze({
      valid,
      status: valid ? 'ready' : 'blocked',
      errors: Object.freeze(errors),
      warnings: Object.freeze(warnings),
    });
  }

  async publish(pkg: PublishingHandoffPackage): Promise<PublishingHandoffPublishResult> {
    const cached = this.idempotencyStore.get(pkg.handoffId);
    if (cached) {
      return cached;
    }

    const validation = this.validate(pkg);
    if (!validation.valid) {
      return Object.freeze({
        success: false,
        targetId: this.targetId,
        error: Object.freeze({
          code: 'validation',
          message: validation.errors[0]?.message ?? 'Handoff package failed validation',
        }),
      });
    }

    const payload = mapHandoffToWordPressPost(pkg, {
      forceDraft: this.forceDraft,
      defaultAuthor: this.config.defaultAuthor,
      defaultStatus: this.config.defaultStatus,
    });
    const summary = buildHandoffPublishRequestSummary(pkg);

    this.logger.info(
      'wp.handoff.publish.start',
      buildSafeHandoffLogMeta({
        handoffId: summary.handoffId,
        slug: summary.slug,
        contentLength: summary.contentLength,
        status: payload.status,
      }),
    );

    try {
      const response = await this.fetchFn(`${this.config.baseUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          Authorization: buildBasicAuth(this.config.username, this.config.appPassword),
          'Content-Type': 'application/json',
          'X-PCME-Handoff-Id': pkg.handoffId,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs ?? 30_000),
      });

      if (!response.ok) {
        const apiError = await parseWordPressErrorResponse(response);
        const mapped = mapWordPressHandoffError(apiError);
        this.logger.error(
          'wp.handoff.publish.api_error',
          buildSafeHandoffLogMeta({
            handoffId: pkg.handoffId,
            slug: payload.slug,
            contentLength: pkg.content.length,
            httpStatus: response.status,
          }),
        );
        return Object.freeze({
          success: false,
          targetId: this.targetId,
          error: Object.freeze({
            code: mapped.code,
            message: redactWordPressSecrets(mapped.message, [this.config.appPassword]),
          }),
        });
      }

      let data: WpPostResponse;
      try {
        data = (await response.json()) as WpPostResponse;
      } catch {
        const failure = Object.freeze({
          success: false,
          targetId: this.targetId,
          error: Object.freeze({
            code: 'malformed-response',
            message: 'WordPress returned a malformed publish response',
          }),
        });
        return failure;
      }

      if (!data.id) {
        return Object.freeze({
          success: false,
          targetId: this.targetId,
          error: Object.freeze({
            code: 'malformed-response',
            message: 'WordPress response missing post ID',
          }),
        });
      }

      const result = Object.freeze({
        success: true,
        targetId: this.targetId,
        externalId: String(data.id),
        url: data.permalink ?? data.link,
        publishedAt: data.date ?? new Date().toISOString(),
        message: `WordPress post created (${payload.status})`,
      });

      this.idempotencyStore.save(pkg.handoffId, result);
      this.logger.info(
        'wp.handoff.publish.success',
        buildSafeHandoffLogMeta({
          handoffId: pkg.handoffId,
          slug: payload.slug,
          contentLength: pkg.content.length,
          status: data.status ?? payload.status,
        }),
      );

      return result;
    } catch (error: unknown) {
      const mapped = mapWordPressHandoffError(error);
      this.logger.error(
        'wp.handoff.publish.error',
        buildSafeHandoffLogMeta({
          handoffId: pkg.handoffId,
          slug: payload.slug,
          contentLength: pkg.content.length,
        }),
      );
      return Object.freeze({
        success: false,
        targetId: this.targetId,
        error: Object.freeze({
          code: mapped.code,
          message: redactWordPressSecrets(mapped.message, [this.config.appPassword]),
        }),
      });
    }
  }
}

export function createWordPressPublishingTargetAdapter(
  env: Record<string, string | undefined> = process.env,
  options?: WordPressPublishingTargetAdapterOptions,
): WordPressPublishingTargetAdapter {
  return new WordPressPublishingTargetAdapter(loadWordPressHandoffAdapterConfig(env), options);
}
