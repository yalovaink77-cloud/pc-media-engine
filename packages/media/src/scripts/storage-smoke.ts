/**
 * Storage smoke script — Sprint 7.
 *
 * Verifies the LocalStorageProvider end-to-end using a temporary directory.
 * No database connection required.
 *
 * Run:
 *   pnpm --filter @pcme/media storage:smoke
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildStorageKey, normalizeKey, validateStorageKey } from '../storage/key.js';
import { StorageKeyNotFoundError } from '../storage/key.js';
import { LocalStorageProvider } from '../storage/local.provider.js';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function ok(msg: string): void {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function section(title: string): void {
  process.stdout.write(`\n▶ ${title}\n`);
}

function fail(msg: string, err: unknown): never {
  process.stderr.write(`\n✗ SMOKE FAILED: ${msg}\n`);
  if (err instanceof Error) process.stderr.write(`  ${err.message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

async function smoke(): Promise<void> {
  process.stdout.write('═══ Sprint 7 Storage Smoke ═══\n');

  const tmpRoot = await mkdtemp(join(tmpdir(), 'pcme-storage-smoke-'));
  const provider = new LocalStorageProvider({ rootDir: tmpRoot, baseUrl: '/files' });

  try {
    // -----------------------------------------------------------------------
    // Key utilities
    // -----------------------------------------------------------------------
    section('Key utilities');

    const rawKey = buildStorageKey('piercingconnect', 'smoke-asset-01', 'navel-aftercare.jpg');
    ok(`buildStorageKey → ${rawKey}`);

    validateStorageKey(rawKey);
    ok('validateStorageKey passes on canonical key');

    const normalized = normalizeKey('//piercingconnect//smoke-asset-01//navel-aftercare.jpg//');
    ok(`normalizeKey → ${normalized}`);

    const publicUrl = provider.getPublicUrl(rawKey);
    ok(`getPublicUrl → ${publicUrl}`);

    // -----------------------------------------------------------------------
    // 1. Exists before write
    // -----------------------------------------------------------------------
    section('Step 1 — Verify key does not exist before write');

    const existsBefore = await provider.exists(rawKey);
    if (existsBefore) fail('expected file to not exist before put', null);
    ok(`exists(${rawKey}) = false`);

    // -----------------------------------------------------------------------
    // 2. Write
    // -----------------------------------------------------------------------
    section('Step 2 — Write sample file');

    const sampleContent = Buffer.from(
      `PC Media Engine — Sprint 7 smoke test\nTimestamp: ${new Date().toISOString()}\n`,
    );

    const confirmedKey = await provider.put(rawKey, sampleContent, 'text/plain');
    if (confirmedKey !== rawKey) fail('put returned unexpected key', null);
    ok(`put(${rawKey}) → confirmed key matches`);
    ok(`content length: ${sampleContent.length} bytes`);

    // -----------------------------------------------------------------------
    // 3. Exists after write
    // -----------------------------------------------------------------------
    section('Step 3 — Verify key exists after write');

    const existsAfter = await provider.exists(rawKey);
    if (!existsAfter) fail('expected file to exist after put', null);
    ok(`exists(${rawKey}) = true`);

    // -----------------------------------------------------------------------
    // 4. Read
    // -----------------------------------------------------------------------
    section('Step 4 — Read file back');

    const readBuf = await provider.get(rawKey);
    if (!readBuf.equals(sampleContent)) fail('read content does not match written content', null);
    ok(`get(${rawKey}) → ${readBuf.length} bytes match`);

    // -----------------------------------------------------------------------
    // 5. Stat / metadata
    // -----------------------------------------------------------------------
    section('Step 5 — Stat / metadata');

    const meta = await provider.stat(rawKey);
    ok(`stat.key          = ${meta.key}`);
    ok(`stat.sizeBytes    = ${meta.sizeBytes}`);
    ok(`stat.lastModified = ${meta.lastModified.toISOString()}`);
    if (meta.sizeBytes !== sampleContent.length) {
      fail(`stat.sizeBytes (${meta.sizeBytes}) !== content length (${sampleContent.length})`, null);
    }

    // -----------------------------------------------------------------------
    // 6. Overwrite
    // -----------------------------------------------------------------------
    section('Step 6 — Overwrite with new content');

    const updatedContent = Buffer.from('overwritten content');
    await provider.put(rawKey, updatedContent, 'text/plain');
    const afterOverwrite = await provider.get(rawKey);
    if (afterOverwrite.toString() !== 'overwritten content') {
      fail('overwrite did not take effect', null);
    }
    ok('overwrite confirmed — new content readable');

    // -----------------------------------------------------------------------
    // 7. Delete
    // -----------------------------------------------------------------------
    section('Step 7 — Delete file');

    await provider.delete(rawKey);
    ok(`delete(${rawKey}) completed`);

    // -----------------------------------------------------------------------
    // 8. Verify deletion
    // -----------------------------------------------------------------------
    section('Step 8 — Verify key no longer exists');

    const existsAfterDelete = await provider.exists(rawKey);
    if (existsAfterDelete) fail('expected file to not exist after delete', null);
    ok(`exists(${rawKey}) = false`);

    let getThrew = false;
    try {
      await provider.get(rawKey);
    } catch (err) {
      if (err instanceof StorageKeyNotFoundError) getThrew = true;
    }
    if (!getThrew) fail('get after delete should throw StorageKeyNotFoundError', null);
    ok('get after delete throws StorageKeyNotFoundError');

    // -----------------------------------------------------------------------
    // 9. Delete of non-existent key is a no-op
    // -----------------------------------------------------------------------
    section('Step 9 — Delete of already-deleted key is a no-op');

    await provider.delete(rawKey);
    ok('second delete did not throw');

    // -----------------------------------------------------------------------
    // 10. Invalid key rejection
    // -----------------------------------------------------------------------
    section('Step 10 — Invalid keys are rejected');

    const invalidKeys = [
      '',
      '../outside/file',
      '/absolute/path',
      'proj//double-slash/file',
      'proj/has space/file',
    ];
    for (const bad of invalidKeys) {
      let threw = false;
      try {
        await provider.exists(bad);
      } catch {
        threw = true;
      }
      if (!threw) fail(`Expected StorageKeyError for key: "${bad}"`, null);
      ok(`invalid key rejected: "${bad}"`);
    }

    // -----------------------------------------------------------------------
    // 11. Nested directory keys
    // -----------------------------------------------------------------------
    section('Step 11 — Nested directory key');

    const nestedKey = 'piercingconnect/smoke-asset-01/variants/thumb-320w.webp';
    await provider.put(nestedKey, Buffer.from('thumb'), 'image/webp');
    const nestedMeta = await provider.stat(nestedKey);
    ok(`nested key written: ${nestedKey}`);
    ok(`nested stat.sizeBytes = ${nestedMeta.sizeBytes}`);
    await provider.delete(nestedKey);
    ok('nested key deleted');

    // -----------------------------------------------------------------------
    // Done
    // -----------------------------------------------------------------------
    process.stdout.write(`
╔══════════════════════════════════════════════════════════════╗
║  ✅  Storage Smoke PASSED — Sprint 7 LocalStorageProvider   ║
╚══════════════════════════════════════════════════════════════╝
Storage root: ${tmpRoot}
Provider:     ${provider.name}
`);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
    process.stdout.write(`Cleaned up temp directory: ${tmpRoot}\n`);
  }
}

smoke().catch((err: unknown) => {
  process.stderr.write(`\n✗ Unhandled error in smoke script:\n`);
  if (err instanceof Error) process.stderr.write(`${err.stack ?? err.message}\n`);
  process.exit(1);
});
