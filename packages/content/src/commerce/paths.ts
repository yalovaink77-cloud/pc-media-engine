import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommerceKnowledgeError } from './errors.js';

const DEFAULT_COMMERCE_REPO_DIR = 'piercingconnect-commerce';

/** Resolve PC Media Engine monorepo root from a module URL. */
export function resolveMediaEngineRoot(fromModuleUrl: string = import.meta.url): string {
  const moduleDir = dirname(fileURLToPath(fromModuleUrl));
  return resolve(moduleDir, '..', '..', '..', '..');
}

/**
 * Locate the piercingconnect-commerce repository.
 * Priority: explicit repoPath → COMMERCE_KNOWLEDGE_PATH env → ../piercingconnect-commerce
 */
export function resolveCommerceRepositoryPath(options?: {
  repoPath?: string;
  mediaEngineRoot?: string;
}): string {
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

  for (const candidate of candidates) {
    if (isCommerceRepositoryRoot(candidate)) {
      return candidate;
    }
  }

  throw new CommerceKnowledgeError(
    `Commerce repository not found. Checked: ${candidates.join(', ')}`,
    { issues: ['Expected data/brands and data/products directories'] },
  );
}

export function isCommerceRepositoryRoot(repoPath: string): boolean {
  return (
    existsSync(join(repoPath, 'data', 'brands')) && existsSync(join(repoPath, 'data', 'products'))
  );
}

export function getBrandsDirectory(repoPath: string): string {
  return join(repoPath, 'data', 'brands');
}

export function getProductsDirectory(repoPath: string): string {
  return join(repoPath, 'data', 'products');
}
