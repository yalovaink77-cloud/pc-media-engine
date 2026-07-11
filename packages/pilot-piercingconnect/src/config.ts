import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Required Markdown sections for the PiercingConnect product-review pilot draft. */
export const PILOT_REQUIRED_SECTIONS = Object.freeze([
  'title',
  'introduction',
  'product overview',
  'ingredients',
  'safety and suitability',
  'benefits',
  'limitations',
  'who it may suit',
  'alternatives',
  'faq',
  'disclosure',
  'source-note',
] as const);

/** Relative commerce repository path from the PCME monorepo root. */
export const DEFAULT_COMMERCE_REPO_RELATIVE_PATH = '../piercingconnect-commerce';

/** Default product used for the first PiercingConnect revenue pilot draft. */
export const DEFAULT_PILOT_PRODUCT_ID = 'neilmed-piercing-aftercare-fine-mist';

/** Gitignored relative output directory for pilot artifacts. */
export const DEFAULT_PILOT_OUTPUT_DIR = 'exports/piercingconnect/pilot';

export interface PiercingConnectPilotConfig {
  readonly productId: string;
  readonly contentType: 'product-review';
  readonly contextRecipe: 'product-review';
  readonly locale: string;
  readonly tone: string;
  readonly outputFormat: 'markdown';
  readonly commerceRepoRelativePath: string;
  readonly outputDirRelativePath: string;
  readonly requiredSections: readonly string[];
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

/** Thin PiercingConnect-specific configuration — does not alter PCME core packages. */
export function createPiercingConnectPilotConfig(
  overrides: Partial<PiercingConnectPilotConfig> = {},
): PiercingConnectPilotConfig {
  const requiredSections = overrides.requiredSections ?? PILOT_REQUIRED_SECTIONS;
  const structureInstruction =
    overrides.structureInstruction ??
    [
      'Write a Markdown product-review draft with these sections in order:',
      ...requiredSections.map((section) => `- ${section}`),
      'Safety rules:',
      '- No diagnosis and no unsupported medical claims.',
      '- No commission-first recommendation language.',
      '- Clearly distinguish manufacturer claims from evidence.',
      '- Include a disclosure placeholder and source-note placeholders.',
      '- Prefer cautious educational language over certainty.',
    ].join('\n');

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
    structureInstruction,
    defaultMaxOutputTokens: overrides.defaultMaxOutputTokens ?? 2_500,
  });
}

export { resolveMonorepoRoot };
