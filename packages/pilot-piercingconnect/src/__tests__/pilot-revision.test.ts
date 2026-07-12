import { describe, expect, it, vi } from 'vitest';

import { runPiercingConnectPilotRevision } from '../run-pilot-revision.js';

describe('runPiercingConnectPilotRevision', () => {
  it('runs the offline revision loop without network or WordPress', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'));
    const result = await runPiercingConnectPilotRevision({
      fixedCreatedAt: '2026-07-12T12:00:00.000Z',
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
