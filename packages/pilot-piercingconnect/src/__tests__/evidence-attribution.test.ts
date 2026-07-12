import { describe, expect, it } from 'vitest';

import { PILOT_REQUIRED_SOURCE_PLACEHOLDERS } from '../config.js';
import {
  preparePublicationDraft,
  PUBLICATION_SOURCE_PLACEHOLDER_REPAIRS,
  resolvePublicationSourcePlaceholders,
} from '../evidence-attribution.js';

describe('resolvePublicationSourcePlaceholders', () => {
  it('resolves all required NeilMed source placeholders', () => {
    const input = [
      'Body claim [Source: APP-aligned aftercare guidance].',
      '',
      '## Source Notes',
      ...PILOT_REQUIRED_SOURCE_PLACEHOLDERS.map((placeholder) => `- ${placeholder}`),
    ].join('\n');

    const resolved = resolvePublicationSourcePlaceholders(input);
    for (const placeholder of PILOT_REQUIRED_SOURCE_PLACEHOLDERS) {
      expect(resolved).not.toContain(placeholder);
      expect(resolved).toContain(PUBLICATION_SOURCE_PLACEHOLDER_REPAIRS[placeholder]);
    }
  });
});

describe('preparePublicationDraft', () => {
  it('chains placeholder resolution and formatting repair', () => {
    const input = 'A simpleformulation with [Source: product official record].';
    const prepared = preparePublicationDraft(input);
    expect(prepared).toContain('simple formulation');
    expect(prepared).toContain('resolved source record');
    expect(prepared).not.toContain('[Source:');
  });
});
