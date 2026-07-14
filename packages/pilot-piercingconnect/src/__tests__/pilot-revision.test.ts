import { afterEach, describe, expect, it, vi } from 'vitest';

import { runPiercingConnectPilotRevision } from '../run-pilot-revision.js';
import {
  cleanupPilotTestDirs,
  createPilotCommerceFixtureRepo,
  createPilotTestOutputDir,
} from './helpers/create-pilot-commerce-fixture.js';

afterEach(async () => {
  await cleanupPilotTestDirs();
});

describe('runPiercingConnectPilotRevision', () => {
  it('runs the offline revision loop without network or WordPress', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const repoPath = await createPilotCommerceFixtureRepo();
    const outputDir = await createPilotTestOutputDir('pcme-pilot-revision-');
    const result = await runPiercingConnectPilotRevision({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
      repoPath,
      outputDir,
    });

    expect(result.published).toBe(false);
    expect(result.wordpressInvoked).toBe(false);
    expect(result.status).toBe('succeeded-pending-review');
    expect(result.revisionArtifactId).toBeDefined();
    expect(result.outputs?.generatedReviewV2Path).toContain('generated-review-v2.md');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
