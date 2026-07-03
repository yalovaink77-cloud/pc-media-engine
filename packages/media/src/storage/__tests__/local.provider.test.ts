import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { StorageKeyError, StorageKeyNotFoundError } from '../key.js';
import { LocalStorageProvider } from '../local.provider.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProvider(rootDir: string, baseUrl?: string): LocalStorageProvider {
  return new LocalStorageProvider({ rootDir, baseUrl });
}

const SAMPLE_KEY = 'proj/asset123/photo.jpg';
const SAMPLE_CONTENT = Buffer.from('hello storage');
const SAMPLE_MIME = 'image/jpeg';

// ---------------------------------------------------------------------------
// Fixture: fresh temp directory per test
// ---------------------------------------------------------------------------

let tmpDir: string;
let provider: LocalStorageProvider;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'pcme-storage-test-'));
  provider = makeProvider(tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// write (put)
// ---------------------------------------------------------------------------

describe('put', () => {
  it('writes a file and returns the key', async () => {
    const result = await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    expect(result).toBe(SAMPLE_KEY);
  });

  it('creates intermediate directories automatically', async () => {
    const deepKey = 'a/b/c/d/e/file.bin';
    await provider.put(deepKey, Buffer.from('deep'), 'application/octet-stream');
    expect(await provider.exists(deepKey)).toBe(true);
  });

  it('the written bytes can be read back', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    const out = await provider.get(SAMPLE_KEY);
    expect(out).toEqual(SAMPLE_CONTENT);
  });
});

// ---------------------------------------------------------------------------
// overwrite behavior
// ---------------------------------------------------------------------------

describe('put (overwrite)', () => {
  it('overwrites an existing file with new content', async () => {
    await provider.put(SAMPLE_KEY, Buffer.from('first'), SAMPLE_MIME);
    await provider.put(SAMPLE_KEY, Buffer.from('second'), SAMPLE_MIME);
    const out = await provider.get(SAMPLE_KEY);
    expect(out.toString()).toBe('second');
  });

  it('stat reflects the size of the overwritten content', async () => {
    await provider.put(SAMPLE_KEY, Buffer.from('x'), SAMPLE_MIME);
    await provider.put(SAMPLE_KEY, Buffer.from('xxxx'), SAMPLE_MIME);
    const meta = await provider.stat(SAMPLE_KEY);
    expect(meta.sizeBytes).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// read (get)
// ---------------------------------------------------------------------------

describe('get', () => {
  it('returns the stored buffer', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    const buf = await provider.get(SAMPLE_KEY);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.toString()).toBe('hello storage');
  });

  it('throws StorageKeyNotFoundError for a missing key', async () => {
    await expect(provider.get('proj/asset123/missing.jpg')).rejects.toThrow(
      StorageKeyNotFoundError,
    );
  });

  it('StorageKeyNotFoundError carries the key', async () => {
    const missingKey = 'proj/asset123/ghost.jpg';
    await expect(provider.get(missingKey)).rejects.toMatchObject({ key: missingKey });
  });
});

// ---------------------------------------------------------------------------
// exists
// ---------------------------------------------------------------------------

describe('exists', () => {
  it('returns false before a file is written', async () => {
    expect(await provider.exists(SAMPLE_KEY)).toBe(false);
  });

  it('returns true after a file is written', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    expect(await provider.exists(SAMPLE_KEY)).toBe(true);
  });

  it('returns false after deletion', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    await provider.delete(SAMPLE_KEY);
    expect(await provider.exists(SAMPLE_KEY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('delete', () => {
  it('removes a file so it no longer exists', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    await provider.delete(SAMPLE_KEY);
    expect(await provider.exists(SAMPLE_KEY)).toBe(false);
  });

  it('is a no-op when the key does not exist', async () => {
    await expect(provider.delete('proj/asset/never-written.jpg')).resolves.toBeUndefined();
  });

  it('after deletion get throws StorageKeyNotFoundError', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    await provider.delete(SAMPLE_KEY);
    await expect(provider.get(SAMPLE_KEY)).rejects.toThrow(StorageKeyNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// stat
// ---------------------------------------------------------------------------

describe('stat', () => {
  it('returns correct sizeBytes', async () => {
    const data = Buffer.from('size-check-data');
    await provider.put(SAMPLE_KEY, data, SAMPLE_MIME);
    const meta = await provider.stat(SAMPLE_KEY);
    expect(meta.sizeBytes).toBe(data.length);
  });

  it('returns the canonical key in the result', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    const meta = await provider.stat(SAMPLE_KEY);
    expect(meta.key).toBe(SAMPLE_KEY);
  });

  it('returns a lastModified Date', async () => {
    await provider.put(SAMPLE_KEY, SAMPLE_CONTENT, SAMPLE_MIME);
    const meta = await provider.stat(SAMPLE_KEY);
    expect(meta.lastModified).toBeInstanceOf(Date);
    expect(meta.lastModified.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('throws StorageKeyNotFoundError for a missing key', async () => {
    await expect(provider.stat('proj/asset/nowhere.jpg')).rejects.toThrow(StorageKeyNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// invalid keys
// ---------------------------------------------------------------------------

describe('invalid keys', () => {
  it('rejects an empty key', async () => {
    await expect(provider.put('', SAMPLE_CONTENT, SAMPLE_MIME)).rejects.toThrow(StorageKeyError);
  });

  it('rejects a key with path traversal (..)', async () => {
    await expect(provider.put('../outside/file.jpg', SAMPLE_CONTENT, SAMPLE_MIME)).rejects.toThrow(
      StorageKeyError,
    );
  });

  it('rejects a key with a leading slash', async () => {
    await expect(provider.put('/proj/asset/file.jpg', SAMPLE_CONTENT, SAMPLE_MIME)).rejects.toThrow(
      StorageKeyError,
    );
  });

  it('rejects a key with consecutive slashes', async () => {
    await expect(provider.put('proj//asset/file.jpg', SAMPLE_CONTENT, SAMPLE_MIME)).rejects.toThrow(
      StorageKeyError,
    );
  });

  it('rejects a key with a trailing slash', async () => {
    await expect(provider.put('proj/asset/', SAMPLE_CONTENT, SAMPLE_MIME)).rejects.toThrow(
      StorageKeyError,
    );
  });

  it('rejects a key with spaces', async () => {
    await expect(
      provider.put('proj/asset/my file.jpg', SAMPLE_CONTENT, SAMPLE_MIME),
    ).rejects.toThrow(StorageKeyError);
  });

  it('exists() also rejects invalid keys', async () => {
    await expect(provider.exists('../bad')).rejects.toThrow(StorageKeyError);
  });

  it('delete() also rejects invalid keys', async () => {
    await expect(provider.delete('../bad')).rejects.toThrow(StorageKeyError);
  });
});

// ---------------------------------------------------------------------------
// nested directories
// ---------------------------------------------------------------------------

describe('nested directories', () => {
  it('handles three-level paths', async () => {
    const key = 'org/project/asset-id/thumb.webp';
    await provider.put(key, Buffer.from('img'), 'image/webp');
    expect(await provider.exists(key)).toBe(true);
  });

  it('handles deep paths with multiple segments', async () => {
    const key = 'a/b/c/d/e.txt';
    await provider.put(key, Buffer.from('deep'), 'text/plain');
    const buf = await provider.get(key);
    expect(buf.toString()).toBe('deep');
  });

  it('different keys in the same directory are independent', async () => {
    const key1 = 'proj/asset/file1.jpg';
    const key2 = 'proj/asset/file2.jpg';
    await provider.put(key1, Buffer.from('one'), SAMPLE_MIME);
    await provider.put(key2, Buffer.from('two'), SAMPLE_MIME);
    await provider.delete(key1);
    expect(await provider.exists(key1)).toBe(false);
    expect(await provider.exists(key2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// path normalization (normalizeKey utility)
// ---------------------------------------------------------------------------

describe('normalizeKey utility', () => {
  it('strips leading slash', async () => {
    const { normalizeKey } = await import('../key.js');
    expect(normalizeKey('/proj/asset/file.jpg')).toBe('proj/asset/file.jpg');
  });

  it('strips trailing slash', async () => {
    const { normalizeKey } = await import('../key.js');
    expect(normalizeKey('proj/asset/file.jpg/')).toBe('proj/asset/file.jpg');
  });

  it('converts backslashes to forward slashes', async () => {
    const { normalizeKey } = await import('../key.js');
    expect(normalizeKey('proj\\asset\\file.jpg')).toBe('proj/asset/file.jpg');
  });

  it('collapses consecutive slashes', async () => {
    const { normalizeKey } = await import('../key.js');
    expect(normalizeKey('proj//asset///file.jpg')).toBe('proj/asset/file.jpg');
  });
});

// ---------------------------------------------------------------------------
// buildStorageKey utility
// ---------------------------------------------------------------------------

describe('buildStorageKey utility', () => {
  it('builds projectSlug/assetId/filename', async () => {
    const { buildStorageKey } = await import('../key.js');
    expect(buildStorageKey('myproject', 'abc123', 'photo.jpg')).toBe('myproject/abc123/photo.jpg');
  });

  it('sanitises spaces in the filename', async () => {
    const { buildStorageKey } = await import('../key.js');
    const key = buildStorageKey('proj', 'id1', 'my file name.jpg');
    expect(key).toBe('proj/id1/my_file_name.jpg');
  });
});

// ---------------------------------------------------------------------------
// getPublicUrl
// ---------------------------------------------------------------------------

describe('getPublicUrl', () => {
  it('returns baseUrl/key with default base', async () => {
    const url = provider.getPublicUrl(SAMPLE_KEY);
    expect(url).toBe(`/files/${SAMPLE_KEY}`);
  });

  it('uses custom baseUrl without trailing slash', async () => {
    const custom = makeProvider(tmpDir, 'http://localhost:3000/files/');
    expect(custom.getPublicUrl(SAMPLE_KEY)).toBe(`http://localhost:3000/files/${SAMPLE_KEY}`);
  });

  it('rejects invalid key in getPublicUrl', () => {
    expect(() => provider.getPublicUrl('../evil')).toThrow(StorageKeyError);
  });
});
