import type {
  PublishingHandoffPackage,
  PublishingHandoffPublishResult,
  PublishingTargetAdapter,
  PublishingTargetCapabilities,
  PublishingValidationResult,
} from './types.js';

export interface FakePublishingTargetAdapterOptions {
  readonly shouldFail?: boolean;
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

/** In-memory fake publishing adapter for tests and offline development only. */
export class FakePublishingTargetAdapter implements PublishingTargetAdapter {
  readonly targetId = 'fake';
  readonly capabilities: PublishingTargetCapabilities = Object.freeze({
    supportedFormats: Object.freeze(['markdown', 'plain-text']),
    supportsDrafts: true,
    supportsScheduling: true,
    supportsFeaturedImage: true,
  });

  constructor(private readonly options: FakePublishingTargetAdapterOptions = {}) {}

  validate(pkg: PublishingHandoffPackage): PublishingValidationResult {
    if (pkg.status !== 'ready') {
      return Object.freeze({
        valid: false,
        status: 'blocked',
        errors: Object.freeze([
          Object.freeze({
            code: 'handoff-not-ready',
            message: `Handoff status ${pkg.status} is not ready for publishing`,
            severity: 'error' as const,
          }),
        ]),
        warnings: Object.freeze([]),
      });
    }

    return Object.freeze({
      valid: true,
      status: 'ready',
      errors: Object.freeze([]),
      warnings: Object.freeze([]),
    });
  }

  publish(pkg: PublishingHandoffPackage): Promise<PublishingHandoffPublishResult> {
    const adapterValidation = this.validate(pkg);
    if (!adapterValidation.valid) {
      return Promise.resolve(
        Object.freeze({
          success: false,
          targetId: this.targetId,
          error: Object.freeze({
            code: 'handoff-not-ready',
            message: 'Handoff package is not ready for publishing',
          }),
        }),
      );
    }

    if (this.options.shouldFail) {
      return Promise.resolve(
        Object.freeze({
          success: false,
          targetId: this.targetId,
          error: Object.freeze({
            code: this.options.failureCode ?? 'fake-publish-failure',
            message: this.options.failureMessage ?? 'Fake publishing adapter simulated failure',
          }),
        }),
      );
    }

    return Promise.resolve(
      Object.freeze({
        success: true,
        targetId: this.targetId,
        externalId: `fake-${pkg.handoffId.slice(0, 12)}`,
        url: `https://fake.example.com/${pkg.publishingMetadata.slug}`,
        publishedAt: new Date().toISOString(),
        message: `Fake published: ${pkg.publishingMetadata.title}`,
      }),
    );
  }
}
