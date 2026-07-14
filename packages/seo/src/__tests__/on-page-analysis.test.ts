import { describe, expect, it } from 'vitest';

import { extractMarkdownFaqEntries } from '../analysis/faq.js';
import {
  containsNormalizedPhrase,
  normalizeSeoText,
  partitionKeywordCoverage,
} from '../analysis/text.js';

describe('normalizeSeoText', () => {
  it('normalizes punctuation and casing for phrase matching', () => {
    expect(normalizeSeoText('NeilMed — Piercing Aftercare!')).toBe('neilmed piercing aftercare');
  });
});

describe('containsNormalizedPhrase', () => {
  it('matches phrases across punctuation differences', () => {
    expect(containsNormalizedPhrase('Uses sterile saline spray daily.', 'sterile saline')).toBe(
      true,
    );
  });
});

describe('partitionKeywordCoverage', () => {
  it('partitions matched and missing keywords deterministically', () => {
    const result = partitionKeywordCoverage('NeilMed sterile saline spray', [
      'NeilMed',
      'saline spray',
      'missing keyword',
    ]);
    expect(result.matched).toEqual(['NeilMed', 'saline spray']);
    expect(result.missing).toEqual(['missing keyword']);
  });
});

describe('extractMarkdownFaqEntries', () => {
  it('extracts FAQ question and answer pairs', () => {
    const markdown = [
      '## FAQ',
      '**Q: How often should I clean my piercing?**',
      'A: Follow professional guidance.',
    ].join('\n');

    const entries = extractMarkdownFaqEntries(markdown);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.question).toBe('How often should I clean my piercing?');
    expect(entries[0]?.answer).toBe('Follow professional guidance.');
  });
});
