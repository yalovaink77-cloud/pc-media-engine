import { lstat, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { CommerceKnowledgeError } from './errors.js';

/** Returns true when `resolvedPath` is equal to or nested under `resolvedRoot`. */
export function isPathContained(resolvedPath: string, resolvedRoot: string): boolean {
  if (resolvedPath === resolvedRoot) {
    return true;
  }

  const rootPrefix = resolvedRoot.endsWith('/') ? resolvedRoot : `${resolvedRoot}/`;
  return resolvedPath.startsWith(rootPrefix);
}

export async function resolveContainedDirectory(
  repoPath: string,
  relativeSegments: string[],
  label: string,
): Promise<string> {
  const directory = join(repoPath, ...relativeSegments);
  let resolvedDirectory: string;

  try {
    resolvedDirectory = await realpath(directory);
  } catch (error) {
    throw new CommerceKnowledgeError(`Unable to resolve ${label} directory`, {
      filePath: directory,
      cause: error,
    });
  }

  const directoryStat = await stat(resolvedDirectory);
  if (!directoryStat.isDirectory()) {
    throw new CommerceKnowledgeError(`${label} path is not a directory`, {
      filePath: resolvedDirectory,
      issues: ['Expected a directory'],
    });
  }

  const resolvedRepo = await realpath(repoPath);
  if (!isPathContained(resolvedDirectory, resolvedRepo)) {
    throw new CommerceKnowledgeError(`${label} directory escapes commerce repository`, {
      filePath: resolvedDirectory,
      issues: ['Directory must remain under the commerce repository root'],
    });
  }

  return resolvedDirectory;
}

export async function resolveContainedYamlFile(
  filePath: string,
  allowedDirectory: string,
): Promise<string> {
  let entryStat;
  try {
    entryStat = await lstat(filePath);
  } catch (error) {
    throw new CommerceKnowledgeError(`Unable to inspect YAML file`, {
      filePath,
      cause: error,
    });
  }

  if (entryStat.isSymbolicLink()) {
    throw new CommerceKnowledgeError(`Symlink not allowed in commerce knowledge directory`, {
      filePath,
      issues: ['Symlinks are not permitted'],
    });
  }

  if (!entryStat.isFile()) {
    throw new CommerceKnowledgeError(`Expected a regular YAML file`, {
      filePath,
      issues: ['Only regular .yaml files are supported'],
    });
  }

  let resolvedFile: string;
  try {
    resolvedFile = await realpath(filePath);
  } catch (error) {
    throw new CommerceKnowledgeError(`Unable to resolve YAML file path`, {
      filePath,
      cause: error,
    });
  }

  const resolvedDirectory = await realpath(allowedDirectory);
  if (!isPathContained(resolvedFile, resolvedDirectory)) {
    throw new CommerceKnowledgeError(`YAML file escapes allowed directory`, {
      filePath: resolvedFile,
      issues: ['Resolved file path must remain under the knowledge directory'],
    });
  }

  return resolvedFile;
}
