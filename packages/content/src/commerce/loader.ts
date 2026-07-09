import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { CommerceKnowledgeError } from './errors.js';
import {
  getBrandsDirectory,
  getProductsDirectory,
  resolveCommerceRepositoryPath,
} from './paths.js';
import type {
  CommerceBrand,
  CommerceKnowledgeLoaderOptions,
  CommerceKnowledgeSnapshot,
  CommerceProduct,
} from './types.js';
import { toCommerceBrand, toCommerceProduct, validateCommerceRecord } from './validation.js';

async function listYamlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => join(directory, entry.name))
    .sort();
}

async function readYamlMapping(filePath: string): Promise<Record<string, unknown>> {
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new CommerceKnowledgeError(`Unable to read ${filePath}`, {
      filePath,
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(contents);
  } catch (error) {
    throw new CommerceKnowledgeError(`Invalid YAML in ${filePath}`, {
      filePath,
      cause: error,
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CommerceKnowledgeError(`Expected YAML mapping in ${filePath}`, { filePath });
  }

  return parsed as Record<string, unknown>;
}

async function loadRecordsFromDirectory<T>(
  directory: string,
  entityLabel: string,
  mapRecord: (record: Record<string, unknown>) => T,
): Promise<T[]> {
  const files = await listYamlFiles(directory);
  const records: T[] = [];

  for (const filePath of files) {
    const parsed = await readYamlMapping(filePath);
    const validation = validateCommerceRecord(parsed, entityLabel);
    if (validation.errors.length > 0) {
      throw new CommerceKnowledgeError(`Validation failed for ${filePath}`, {
        filePath,
        issues: validation.errors,
      });
    }
    records.push(mapRecord(parsed));
  }

  return records;
}

/** Load all brand YAML records from the commerce repository. */
export async function loadCommerceBrands(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<{ repoPath: string; brands: CommerceBrand[] }> {
  const repoPath = resolveCommerceRepositoryPath(options);
  const brands = await loadRecordsFromDirectory(
    getBrandsDirectory(repoPath),
    'brand',
    toCommerceBrand,
  );
  return { repoPath, brands };
}

/** Load all product YAML records from the commerce repository. */
export async function loadCommerceProducts(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<{ repoPath: string; products: CommerceProduct[] }> {
  const repoPath = resolveCommerceRepositoryPath(options);
  const products = await loadRecordsFromDirectory(
    getProductsDirectory(repoPath),
    'product',
    toCommerceProduct,
  );
  return { repoPath, products };
}

/** Load brands and products from the commerce repository. Offline-first; no network I/O. */
export async function loadCommerceKnowledge(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<CommerceKnowledgeSnapshot> {
  const repoPath = resolveCommerceRepositoryPath(options);
  const [brands, products] = await Promise.all([
    loadRecordsFromDirectory(getBrandsDirectory(repoPath), 'brand', toCommerceBrand),
    loadRecordsFromDirectory(getProductsDirectory(repoPath), 'product', toCommerceProduct),
  ]);

  return { repoPath, brands, products };
}
