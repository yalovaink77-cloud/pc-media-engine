import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommerceKnowledgeError } from './errors.js';
import { resolveContainedDirectory } from './path-security.js';
import type { CommerceKnowledgeLoaderOptions } from './types.js';

const DEFAULT_COMMERCE_REPO_DIR = 'piercingconnect-commerce';

/** Resolve PC Media Engine monorepo root from a module URL. */
export function resolveMediaEngineRoot(fromModuleUrl: string = import.meta.url): string {
  const moduleDir = dirname(fileURLToPath(fromModuleUrl));
  return resolve(moduleDir, '..', '..', '..', '..');
}

function listRepositoryCandidates(options?: CommerceKnowledgeLoaderOptions): string[] {
  const candidates: string[] = [];

  if (options?.repoPath?.trim()) {
    candidates.push(resolve(options.repoPath));
  }

  const envPath = process.env.COMMERCE_KNOWLEDGE_PATH?.trim();
  if (envPath) {
    candidates.push(resolve(envPath));
  }

  const mediaEngineRoot = options?.mediaEngineRoot ?? resolveMediaEngineRoot();
  candidates.push(resolve(mediaEngineRoot, '..', DEFAULT_COMMERCE_REPO_DIR));

  return candidates;
}

export function isCommerceRepositoryRoot(repoPath: string): boolean {
  return (
    existsSync(join(repoPath, 'data', 'brands')) && existsSync(join(repoPath, 'data', 'products'))
  );
}

/**
 * Locate and canonicalize the piercingconnect-commerce repository root.
 * Priority: explicit repoPath → COMMERCE_KNOWLEDGE_PATH env → ../piercingconnect-commerce
 */
export async function resolveCommerceRepositoryPath(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<string> {
  const candidates = listRepositoryCandidates(options);
  const checked: string[] = [];

  for (const candidate of candidates) {
    checked.push(candidate);
    if (!isCommerceRepositoryRoot(candidate)) {
      continue;
    }

    try {
      const resolved = await realpath(candidate);
      if (!isCommerceRepositoryRoot(resolved)) {
        continue;
      }
      return resolved;
    } catch {
      continue;
    }
  }

  throw new CommerceKnowledgeError('Commerce repository not found', {
    issues: [
      'Expected data/brands and data/products directories',
      `Checked ${checked.length} candidate path(s)`,
    ],
  });
}

export async function getBrandsDirectory(repoPath: string): Promise<string> {
  return resolveContainedDirectory(repoPath, ['data', 'brands'], 'brands');
}

export async function getProductsDirectory(repoPath: string): Promise<string> {
  return resolveContainedDirectory(repoPath, ['data', 'products'], 'products');
}

export async function getCommerceDataDirectory(
  repoPath: string,
  dataSegments: readonly string[],
  label: string,
): Promise<string> {
  return resolveContainedDirectory(repoPath, ['data', ...dataSegments], label);
}
