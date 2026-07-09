import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { DEFAULT_MAX_YAML_FILE_BYTES, DEFAULT_YAML_MAX_ALIAS_COUNT } from './constants.js';
import { CommerceKnowledgeError } from './errors.js';
import { resolveContainedYamlFile } from './path-security.js';
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

interface LoaderRuntimeOptions {
  maxYamlFileBytes: number;
  maxAliasCount: number;
}

function resolveLoaderRuntimeOptions(
  options?: CommerceKnowledgeLoaderOptions,
): LoaderRuntimeOptions {
  return {
    maxYamlFileBytes: options?.maxYamlFileBytes ?? DEFAULT_MAX_YAML_FILE_BYTES,
    maxAliasCount: options?.maxAliasCount ?? DEFAULT_YAML_MAX_ALIAS_COUNT,
  };
}

async function listYamlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith('.yaml')) {
      continue;
    }

    const candidatePath = join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      throw new CommerceKnowledgeError(`Symlink not allowed in commerce knowledge directory`, {
        filePath: candidatePath,
        issues: ['Symlinks are not permitted'],
      });
    }

    if (!entry.isFile()) {
      continue;
    }

    const resolvedPath = await resolveContainedYamlFile(candidatePath, directory);
    files.push(resolvedPath);
  }

  return files.sort();
}

async function readYamlMapping(
  filePath: string,
  runtimeOptions: LoaderRuntimeOptions,
): Promise<Record<string, unknown>> {
  const fileStat = await stat(filePath);
  if (fileStat.size > runtimeOptions.maxYamlFileBytes) {
    throw new CommerceKnowledgeError(`YAML file exceeds maximum size`, {
      filePath,
      issues: [`Maximum allowed size is ${runtimeOptions.maxYamlFileBytes} bytes`],
    });
  }

  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new CommerceKnowledgeError(`Unable to read YAML file`, {
      filePath,
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(contents, { maxAliasCount: runtimeOptions.maxAliasCount });
  } catch (error) {
    throw new CommerceKnowledgeError(`Invalid YAML`, {
      filePath,
      cause: error,
    });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CommerceKnowledgeError(`Expected YAML mapping`, { filePath });
  }

  return parsed as Record<string, unknown>;
}

async function loadRecordsFromDirectory<T>(
  directory: string,
  entityLabel: string,
  mapRecord: (record: Record<string, unknown>) => T,
  runtimeOptions: LoaderRuntimeOptions,
): Promise<T[]> {
  const files = await listYamlFiles(directory);
  const records: T[] = [];

  for (const filePath of files) {
    const parsed = await readYamlMapping(filePath, runtimeOptions);
    const validation = validateCommerceRecord(parsed, entityLabel);
    if (validation.errors.length > 0) {
      throw new CommerceKnowledgeError(`Validation failed`, {
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
  const runtimeOptions = resolveLoaderRuntimeOptions(options);
  const repoPath = await resolveCommerceRepositoryPath(options);
  const brands = await loadRecordsFromDirectory(
    await getBrandsDirectory(repoPath),
    'brand',
    toCommerceBrand,
    runtimeOptions,
  );
  return { repoPath, brands };
}

/** Load all product YAML records from the commerce repository. */
export async function loadCommerceProducts(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<{ repoPath: string; products: CommerceProduct[] }> {
  const runtimeOptions = resolveLoaderRuntimeOptions(options);
  const repoPath = await resolveCommerceRepositoryPath(options);
  const products = await loadRecordsFromDirectory(
    await getProductsDirectory(repoPath),
    'product',
    toCommerceProduct,
    runtimeOptions,
  );
  return { repoPath, products };
}

/** Load brands and products from the commerce repository. Offline-first; no network I/O. */
export async function loadCommerceKnowledge(
  options?: CommerceKnowledgeLoaderOptions,
): Promise<CommerceKnowledgeSnapshot> {
  const runtimeOptions = resolveLoaderRuntimeOptions(options);
  const repoPath = await resolveCommerceRepositoryPath(options);
  const [brands, products] = await Promise.all([
    loadRecordsFromDirectory(
      await getBrandsDirectory(repoPath),
      'brand',
      toCommerceBrand,
      runtimeOptions,
    ),
    loadRecordsFromDirectory(
      await getProductsDirectory(repoPath),
      'product',
      toCommerceProduct,
      runtimeOptions,
    ),
  ]);

  return { repoPath, brands, products };
}
