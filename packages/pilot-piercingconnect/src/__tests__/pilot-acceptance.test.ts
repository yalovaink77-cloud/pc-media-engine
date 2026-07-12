import { describe, expect, it, vi } from 'vitest';

import { runPiercingConnectPilotAcceptance } from '../run-pilot-acceptance.js';

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
});
