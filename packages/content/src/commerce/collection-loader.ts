import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { DEFAULT_MAX_YAML_FILE_BYTES, DEFAULT_YAML_MAX_ALIAS_COUNT } from './constants.js';
import { CommerceKnowledgeError } from './errors.js';
import { resolveContainedYamlFile } from './path-security.js';
import { getCommerceDataDirectory } from './paths.js';
import type { CommerceKnowledgeLoaderOptions } from './types.js';
import {
  normalizeCommerceIdentity,
  toCommerceCollectionRecord,
  validateCommerceRecord,
} from './validation.js';

export interface CommerceCollectionRecord {
  id: string;
  slug: string;
  name: string;
  raw: Record<string, unknown>;
}

interface LoaderRuntimeOptions {
  maxYamlFileBytes: number;
  maxAliasCount: number;
}

interface LoadCommerceCollectionOptions extends CommerceKnowledgeLoaderOptions {
  displayNameFields?: readonly string[];
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

/** Load YAML records from a commerce repository data subdirectory. */
export async function loadCommerceCollection(
  repoPath: string,
  dataSegments: readonly string[],
  entityLabel: string,
  options?: LoadCommerceCollectionOptions,
): Promise<CommerceCollectionRecord[]> {
  const runtimeOptions = resolveLoaderRuntimeOptions(options);
  const directory = await getCommerceDataDirectory(repoPath, dataSegments, entityLabel);
  const files = await listYamlFiles(directory);
  const records: CommerceCollectionRecord[] = [];

  for (const filePath of files) {
    const parsed = await readYamlMapping(filePath, runtimeOptions);
    const normalized = normalizeCommerceIdentity(parsed, entityLabel, {
      displayNameFields: options?.displayNameFields,
    });

    if (normalized.errors.length > 0) {
      throw new CommerceKnowledgeError(`Validation failed`, {
        filePath,
        issues: normalized.errors,
      });
    }

    records.push(toCommerceCollectionRecord(parsed, normalized.identity!));
  }

  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}

/** Backward-compatible strict loader used by brand and product collection APIs. */
export async function loadValidatedCommerceCollection(
  repoPath: string,
  dataSegments: readonly string[],
  entityLabel: string,
  mapRecord: (record: Record<string, unknown>) => CommerceCollectionRecord,
  options?: CommerceKnowledgeLoaderOptions,
): Promise<CommerceCollectionRecord[]> {
  const runtimeOptions = resolveLoaderRuntimeOptions(options);
  const directory = await getCommerceDataDirectory(repoPath, dataSegments, entityLabel);
  const files = await listYamlFiles(directory);
  const records: CommerceCollectionRecord[] = [];

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

  records.sort((a, b) => a.id.localeCompare(b.id));
  return records;
}
