import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Required Markdown sections for the PiercingConnect product-review pilot.
 * Detection matches heading text aliases, not raw substrings.
 */
export const PILOT_REQUIRED_SECTIONS = Object.freeze([
  Object.freeze({
    id: 'title',
    label: 'Title',
    headingAliases: Object.freeze(['title']),
    acceptLeadingH1: true,
  }),
  Object.freeze({
    id: 'editorial-summary',
    label: 'Editorial Summary',
    headingAliases: Object.freeze(['editorial summary', 'editorial-summary']),
  }),
  Object.freeze({
    id: 'product-overview',
    label: 'Product Overview',
    headingAliases: Object.freeze(['product overview', 'product-overview']),
  }),
  Object.freeze({
    id: 'verified-formula',
    label: 'Verified Formula',
    headingAliases: Object.freeze(['verified formula', 'verified-formula']),
  }),
  Object.freeze({
    id: 'evidence-and-guideline-alignment',
    label: 'Evidence and Guideline Alignment',
    headingAliases: Object.freeze([
      'evidence and guideline alignment',
      'evidence-and-guideline-alignment',
    ]),
  }),
  Object.freeze({
    id: 'potential-advantages',
    label: 'Potential Advantages',
    headingAliases: Object.freeze(['potential advantages', 'potential-advantages']),
  }),
  Object.freeze({
    id: 'limitations-and-uncertainties',
    label: 'Limitations and Uncertainties',
    headingAliases: Object.freeze([
      'limitations and uncertainties',
      'limitations-and-uncertainties',
    ]),
  }),
  Object.freeze({
    id: 'who-may-consider-it',
    label: 'Who May Consider It',
    headingAliases: Object.freeze(['who may consider it', 'who-may-consider-it']),
  }),
  Object.freeze({
    id: 'who-should-seek-professional-guidance',
    label: 'Who Should Seek Professional Guidance',
    headingAliases: Object.freeze([
      'who should seek professional guidance',
      'who-should-seek-professional-guidance',
    ]),
  }),
  Object.freeze({
    id: 'alternatives',
    label: 'Alternatives',
    headingAliases: Object.freeze(['alternatives']),
  }),
  Object.freeze({
    id: 'faq',
    label: 'FAQ',
    headingAliases: Object.freeze(['faq', 'frequently asked questions']),
  }),
  Object.freeze({
    id: 'affiliate-disclosure-placeholder',
    label: 'Affiliate Disclosure Placeholder',
    headingAliases: Object.freeze([
      'affiliate disclosure placeholder',
      'affiliate disclosure',
      'disclosure',
    ]),
  }),
  Object.freeze({
    id: 'source-notes',
    label: 'Source Notes',
    headingAliases: Object.freeze(['source notes', 'source-notes', 'source-note', 'source note']),
  }),
] as const);

export type PilotRequiredSection = (typeof PILOT_REQUIRED_SECTIONS)[number];

/** Relative commerce repository path from the PCME monorepo root. */
export const DEFAULT_COMMERCE_REPO_RELATIVE_PATH = '../piercingconnect-commerce';

/** Default product used for the first PiercingConnect revenue pilot draft. */
export const DEFAULT_PILOT_PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

/** Gitignored relative output directory for pilot artifacts. */
export const DEFAULT_PILOT_OUTPUT_DIR = 'exports/piercingconnect/pilot';

/** Structured source-note placeholders required for citation readiness. */
export const PILOT_REQUIRED_SOURCE_PLACEHOLDERS = Object.freeze([
  '[Source: product official record]',
  '[Source: ingredient evidence record]',
  '[Source: APP-aligned aftercare guidance]',
] as const);

export interface PiercingConnectPilotConfig {
  readonly productId: string;
  readonly contentType: 'product-review';
  readonly contextRecipe: 'product-review';
  readonly locale: string;
  readonly tone: string;
  readonly outputFormat: 'markdown';
  readonly commerceRepoRelativePath: string;
  readonly outputDirRelativePath: string;
  readonly requiredSections: readonly PilotRequiredSection[];
  readonly requiredSourcePlaceholders: readonly string[];
  readonly structureInstruction: string;
  readonly defaultMaxOutputTokens: number;
}

function resolveMonorepoRoot(fromModuleUrl: string = import.meta.url): string {
  const moduleDir = dirname(fileURLToPath(fromModuleUrl));
  return resolve(moduleDir, '..', '..', '..');
}

/** Resolve the absolute commerce repository path for the pilot (read-only). */
export function resolvePilotCommerceRepoPath(
  options: {
    mediaEngineRoot?: string;
    commerceRepoRelativePath?: string;
    repoPath?: string;
  } = {},
): string {
  if (options.repoPath?.trim()) {
    return resolve(options.repoPath);
  }

  const root = options.mediaEngineRoot ?? resolveMonorepoRoot();
  const relative = options.commerceRepoRelativePath ?? DEFAULT_COMMERCE_REPO_RELATIVE_PATH;
  return resolve(root, relative);
}

/** Resolve the pilot output directory under the monorepo root. */
export function resolvePilotOutputDir(
  options: {
    mediaEngineRoot?: string;
    outputDirRelativePath?: string;
  } = {},
): string {
  const root = options.mediaEngineRoot ?? resolveMonorepoRoot();
  return resolve(root, options.outputDirRelativePath ?? DEFAULT_PILOT_OUTPUT_DIR);
}

function buildDefaultStructureInstruction(
  requiredSections: readonly PilotRequiredSection[],
  requiredSourcePlaceholders: readonly string[],
): string {
  return [
    'Write a Markdown product-review draft with these ATX headings in order:',
    ...requiredSections.map((section) => `- ## ${section.label}`),
    'The document may start with a single H1 product title; still include ## Title when practical.',
    'Quality and evidence rules:',
    '- Use educational, non-promotional language only.',
    '- Distinguish verified structured facts, manufacturer positioning, professional guidance, and uncertainty.',
    '- Do not invent URLs, citations, clinical outcomes, or missing evidence.',
    '- Do not claim universal suitability for all piercing types.',
    '- Do not state fixed usage frequency (for example "1-2 times daily") unless explicitly present in supplied context as a verified fact.',
    '- Do not claim sensitive-skin suitability, reduced bacterial risk, or guaranteed healing benefits without verified evidence in context.',
    '- Prefer "may", "according to manufacturer materials", and "consult a qualified professional" over certainty.',
    'Source Notes must include these structured placeholders (do not invent links):',
    ...requiredSourcePlaceholders.map((placeholder) => `- ${placeholder}`),
    'Include an Affiliate Disclosure Placeholder section that remains a placeholder until human review.',
  ].join('\n');
}

/** Thin PiercingConnect-specific configuration — does not alter PCME core packages. */
export function createPiercingConnectPilotConfig(
  overrides: Partial<PiercingConnectPilotConfig> = {},
): PiercingConnectPilotConfig {
  const requiredSections = overrides.requiredSections ?? PILOT_REQUIRED_SECTIONS;
  const requiredSourcePlaceholders =
    overrides.requiredSourcePlaceholders ?? PILOT_REQUIRED_SOURCE_PLACEHOLDERS;
  const structureInstruction =
    overrides.structureInstruction ??
    buildDefaultStructureInstruction(requiredSections, requiredSourcePlaceholders);

  return Object.freeze({
    productId: overrides.productId ?? DEFAULT_PILOT_PRODUCT_ID,
    contentType: 'product-review',
    contextRecipe: 'product-review',
    locale: overrides.locale ?? 'en',
    tone: overrides.tone ?? 'educational',
    outputFormat: 'markdown',
    commerceRepoRelativePath:
      overrides.commerceRepoRelativePath ?? DEFAULT_COMMERCE_REPO_RELATIVE_PATH,
    outputDirRelativePath: overrides.outputDirRelativePath ?? DEFAULT_PILOT_OUTPUT_DIR,
    requiredSections,
    requiredSourcePlaceholders,
    structureInstruction,
    defaultMaxOutputTokens: overrides.defaultMaxOutputTokens ?? 2_500,
  });
}

export { resolveMonorepoRoot };
