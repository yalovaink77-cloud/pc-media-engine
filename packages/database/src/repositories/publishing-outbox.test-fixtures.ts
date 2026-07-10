import type { PublishingHandoffPackagePayload } from '@pcme/shared';

const policySnapshot = Object.freeze({
  safetyConstraints: Object.freeze(['no-diagnosis']),
  affiliateConstraints: Object.freeze(['disclose-affiliate']),
  citationRequirements: Object.freeze(['cite-sources']),
  blockedFields: Object.freeze(['sourcePath']),
  strictMode: false,
  contextComplete: true,
  warningCount: 0,
});

export function buildSampleHandoffPackagePayload(
  overrides?: Partial<PublishingHandoffPackagePayload>,
): PublishingHandoffPackagePayload {
  return Object.freeze({
    handoffId: 'handoff-001',
    artifactId: 'artifact-001',
    reviewId: 'review-001',
    jobId: 'job-001',
    requestId: 'request-001',
    sourceId: 'source-001',
    snapshotId: 'snapshot-001',
    contentType: 'product-review',
    locale: 'en-US',
    format: 'markdown',
    content: '# Review\nBalanced guidance.',
    target: Object.freeze({
      targetId: 'wordpress',
      platform: 'wordpress',
      supportedFormats: Object.freeze(['markdown']),
    }),
    publishingMetadata: Object.freeze({
      title: 'Sample Review',
      slug: 'sample-review',
      publishStatus: 'draft' as const,
    }),
    policySnapshot,
    reviewSummary: Object.freeze({
      reviewId: 'review-001',
      status: 'approved' as const,
      findingCount: 0,
    }),
    warnings: Object.freeze([]),
    status: 'ready' as const,
    createdAt: '2026-07-10T12:00:00.000Z',
    ...overrides,
  });
}

export { policySnapshot };
