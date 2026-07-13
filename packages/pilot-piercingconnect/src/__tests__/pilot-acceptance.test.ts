import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  GenerationProviderAdapter,
  GenerationProviderRequest,
  GenerationProviderResponse,
} from '@pcme/ai';
import type {
  PublishingHandoffPackage,
  PublishingHandoffPublishResult,
  PublishingTargetAdapter,
  PublishingTargetCapabilities,
  PublishingValidationResult,
} from '@pcme/publishing';
import type { GeneratedContentArtifact } from '@pcme/shared';
import { describe, expect, it, vi } from 'vitest';

import { RESOLVED_AFFILIATE_DISCLOSURE } from '../commercial-attribution.js';
import { PiercingConnectPilotError } from '../errors.js';
import {
  prepareActiveArtifactForHandoff,
  runPiercingConnectPilotAcceptance,
} from '../run-pilot-acceptance.js';
import {
  assertPilotDraftPublishStatus,
  requirePilotWordPressForceDraft,
  resolvePilotPublishingTargetAdapter,
} from '../wordpress-draft-safety.js';

class StubWordPressAdapter implements PublishingTargetAdapter {
  readonly targetId = 'wordpress';
  readonly capabilities: PublishingTargetCapabilities = Object.freeze({
    supportedFormats: Object.freeze(['markdown', 'plain-text', 'html']),
    supportsDrafts: true,
    supportsScheduling: true,
    supportsFeaturedImage: true,
  });

  validate(pkg: PublishingHandoffPackage): PublishingValidationResult {
    return Object.freeze({
      valid: pkg.status === 'ready',
      status: pkg.status === 'ready' ? 'ready' : 'blocked',
      errors: Object.freeze([]),
      warnings: Object.freeze([]),
    });
  }

  publish(pkg: PublishingHandoffPackage): Promise<PublishingHandoffPublishResult> {
    return Promise.resolve(
      Object.freeze({
        success: true,
        targetId: this.targetId,
        externalId: `wp-${pkg.handoffId.slice(0, 8)}`,
        url: `https://example.com/${pkg.publishingMetadata.slug}`,
        publishedAt: new Date().toISOString(),
        message: 'stub wordpress draft',
      }),
    );
  }
}

class UnpreparedRevisionProvider implements GenerationProviderAdapter {
  readonly providerId = 'unprepared-fake';
  readonly capabilities = Object.freeze({
    supportedOutputFormats: Object.freeze(['markdown'] as const),
  });

  constructor(private readonly content: string) {}

  generate(_request: GenerationProviderRequest): Promise<GenerationProviderResponse> {
    return Promise.resolve(
      Object.freeze({
        providerId: this.providerId,
        status: 'succeeded' as const,
        content: this.content,
        model: 'fake-model',
        finishReason: 'stop',
      }),
    );
  }
}

describe('wordpress draft safety', () => {
  it('rejects real WordPress configuration when forceDraft is false', () => {
    expect(() => requirePilotWordPressForceDraft({ forceDraft: false })).toThrow(
      PiercingConnectPilotError,
    );
    expect(() => requirePilotWordPressForceDraft({})).toThrow(/forceDraft is true/);
    expect(() =>
      resolvePilotPublishingTargetAdapter({
        publishingTargetAdapter: new StubWordPressAdapter(),
        wordpressForceDraft: false,
      }),
    ).toThrow(/forceDraft is true/);
  });

  it('accepts real WordPress configuration when forceDraft is true', () => {
    expect(requirePilotWordPressForceDraft({ forceDraft: true })).toEqual({ forceDraft: true });
    const adapter = resolvePilotPublishingTargetAdapter({
      publishingTargetAdapter: new StubWordPressAdapter(),
      wordpressForceDraft: true,
    });
    expect(adapter.targetId).toBe('wordpress');
  });

  it('refuses non-draft publish status in the pilot path', () => {
    expect(() => assertPilotDraftPublishStatus('publish')).toThrow(/non-draft/);
    expect(assertPilotDraftPublishStatus('draft')).toBe('draft');
  });
});

describe('prepareActiveArtifactForHandoff', () => {
  it('prepares content without mutating the prior/active source artifact', () => {
    const active = Object.freeze({
      artifactId: 'artifact-active',
      jobId: 'job-1',
      requestId: 'request-1',
      sourceId: 'source-1',
      snapshotId: 'snapshot-1',
      providerId: 'fake',
      contentType: 'product-review',
      locale: 'en',
      tone: 'educational',
      format: 'markdown',
      content:
        '## Affiliate Disclosure Placeholder\n[Affiliate Disclosure Placeholder]\n\n## Source Notes\n- [Source: product official record]',
      warnings: Object.freeze([]),
      policySnapshot: Object.freeze({
        safetyConstraints: Object.freeze([]),
        affiliateConstraints: Object.freeze([]),
        citationRequirements: Object.freeze([]),
        blockedFields: Object.freeze([]),
        strictMode: false,
        contextComplete: true,
        warningCount: 0,
      }),
      status: 'generated',
      createdAt: '2026-07-12T12:00:00.000Z',
    }) as GeneratedContentArtifact;

    const before = active.content;
    const prepared = prepareActiveArtifactForHandoff(active);

    expect(active.content).toBe(before);
    expect(prepared.artifactId).toBe(active.artifactId);
    expect(prepared.jobId).toBe(active.jobId);
    expect(prepared.content).toContain(RESOLVED_AFFILIATE_DISCLOSURE);
    expect(prepared.content).toContain('resolved source record from product official record');
    expect(prepared.content).not.toContain('[Affiliate Disclosure Placeholder]');
  });
});

describe('runPiercingConnectPilotAcceptance', () => {
  it('runs the offline acceptance pipeline without network, publish, or live WordPress', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const result = await runPiercingConnectPilotAcceptance({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
    });

    expect(result.published).toBe(false);
    expect(result.status).toBe('succeeded-pending-review');
    expect(result.outputs?.acceptanceReportPath).toContain('acceptance-report.json');
    expect(result.outputs?.wordpressDraftPath).toContain('wordpress-draft.md');
    expect(result.outputs?.wordpressHandoffPath).toContain('wordpress-handoff-package.json');
    expect(result.humanReviewStatus).toBe('approved-with-notes');
    expect(result.wordpressDraftStatus).toBe('ready');
    expect(result.wordpressInvoked).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects a wordpress adapter when forceDraft is false', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const result = await runPiercingConnectPilotAcceptance({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
      publishingTargetAdapter: new StubWordPressAdapter(),
      wordpressForceDraft: false,
    });

    expect(result.status).toBe('failed');
    expect(result.published).toBe(false);
    expect(result.error?.code).toBe('wordpress-force-draft-required');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('accepts a wordpress adapter when forceDraft is true without network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const result = await runPiercingConnectPilotAcceptance({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
      publishingTargetAdapter: new StubWordPressAdapter(),
      wordpressForceDraft: true,
    });

    expect(result.status).toBe('succeeded-pending-review');
    expect(result.published).toBe(false);
    expect(result.wordpressDraftStatus).toBe('ready');
    expect(result.wordpressInvoked).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('prepares final active revision content before handoff and keeps prior artifact immutable', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const outputDir = await mkdtemp(join(tmpdir(), 'pcme-pilot-handoff-prep-'));
    const unprepared = [
      '# NeilMed Piercing Aftercare Fine Mist',
      '',
      '## Editorial Summary',
      'Summary with simpleformulation token.',
      '',
      '## Affiliate Disclosure Placeholder',
      '[Affiliate Disclosure Placeholder]',
      '',
      '## Source Notes',
      '- [Source: product official record]',
      '- [Source: ingredient evidence record]',
      '- [Source: APP-aligned aftercare guidance]',
    ].join('\n');

    const result = await runPiercingConnectPilotAcceptance({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
      outputDir,
      generationProvider: new UnpreparedRevisionProvider(unprepared),
    });

    expect(result.status).toBe('succeeded-pending-review');
    expect(result.published).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    const handoff = JSON.parse(
      await readFile(join(outputDir, 'wordpress-handoff-package.json'), 'utf8'),
    ) as { content: string; publishingMetadata: { publishStatus: string } };
    const draftV1 = await readFile(join(outputDir, 'generated-review.md'), 'utf8');
    const draftV2 = await readFile(join(outputDir, 'generated-review-v2.md'), 'utf8');

    expect(handoff.publishingMetadata.publishStatus).toBe('draft');
    expect(handoff.content).toContain(RESOLVED_AFFILIATE_DISCLOSURE);
    expect(handoff.content).toContain('resolved source record from product official record');
    expect(handoff.content).toContain('simple formulation');
    expect(handoff.content).not.toContain('[Affiliate Disclosure Placeholder]');
    expect(handoff.content).not.toContain('simpleformulation');
    expect(draftV2).toContain(RESOLVED_AFFILIATE_DISCLOSURE);
    // Prior (v1) fixture path remains independently prepared; unprepared provider only affects revision.
    expect(draftV1).not.toContain('simpleformulation');
    expect(draftV1).not.toEqual(unprepared);

    fetchSpy.mockRestore();
  });
});
