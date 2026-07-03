# Sprint 7 — Local Storage Foundation

**Status:** Complete  
**Tag:** v0.7.0-alpha-sprint7 (pending)

## Goal

Implement the storage layer that the domain has been using conceptually since Sprint 3.
Sprint 7 is infrastructure only — no API, no workers, no queue, no media processing.

## Scope

### Implemented

| Component | Location | Description |
|---|---|---|
| `StorageProvider` interface | `packages/media/src/storage/provider.ts` | Abstract contract for all storage backends |
| `StorageMeta` type | same | Metadata returned by `stat()` |
| `StorageKeyError` | `packages/media/src/storage/key.ts` | Key fails structural validation |
| `StorageKeyNotFoundError` | same | Key references a non-existent file |
| `validateStorageKey()` | same | Rejects empty, `..`, leading `/`, `//`, unsafe chars |
| `normalizeKey()` | same | Strips and collapses separators, converts backslashes |
| `buildStorageKey()` | same | `{projectSlug}/{assetId}/{filename}` builder |
| `LocalStorageConfig` | `packages/media/src/storage/config.ts` | Config type + env loader |
| `loadLocalStorageConfig()` | same | Reads `STORAGE_LOCAL_ROOT` + `STORAGE_BASE_URL` |
| `LocalStorageProvider` | `packages/media/src/storage/local.provider.ts` | Full local filesystem implementation |
| `MediaUrlResolver` | `packages/media/src/storage/url-resolver.ts` | Key → public URL (unchanged from Sprint 6) |
| Vitest test suite | `packages/media/src/storage/__tests__/local.provider.test.ts` | 38 tests, 0 failures |
| Storage smoke script | `packages/media/src/scripts/storage-smoke.ts` | 11 steps, no database |
| Provider re-export | `providers/storage/local/src/index.ts` | Thin re-export from `@pcme/media` |

### Not implemented (deferred)

- S3 / MinIO / GCS / Azure Blob / Cloudflare R2 implementations
- CDN or signed URLs
- Upload API or Fastify routes
- Worker runtime or queue integration
- Thumbnail generation (Sharp / FFmpeg)
- Authentication

## StorageProvider Interface

```typescript
interface StorageProvider {
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  stat(key: string): Promise<StorageMeta>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  readonly name: string;
}

type StorageMeta = {
  key: string;
  sizeBytes: number;
  lastModified: Date;
};
```

## storageKey Rules

A `storageKey` is the canonical identifier for a file, stored in the database and passed directly to the `StorageProvider`.

| Rule | Detail |
|---|---|
| No leading slash | `proj/asset/file.jpg` ✓, `/proj/asset/file.jpg` ✗ |
| No trailing slash | must end with a filename |
| No `..` segments | path traversal rejected at validation layer |
| No consecutive `//` | normalise before validating |
| Safe characters only | `a-z A-Z 0-9 . _ - /` |
| Canonical pattern | `{projectSlug}/{assetId}/{filename}` |

See also: `docs/architecture/storage-key-lifecycle.md`

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `STORAGE_LOCAL_ROOT` | *(required)* | Absolute path to local file storage root |
| `STORAGE_BASE_URL` | `/files` | URL prefix for `getPublicUrl()` |

Example `.env` entry:
```
STORAGE_LOCAL_ROOT=/var/data/pcme-media
STORAGE_BASE_URL=http://localhost:3000/files
```

## LocalStorageProvider Behaviour

| Operation | Behaviour |
|---|---|
| `put` | Writes file; creates intermediate directories with `mkdir -p` |
| `put` (overwrite) | Last writer wins — no locking in dev mode |
| `get` | Returns `Buffer`; throws `StorageKeyNotFoundError` if missing |
| `exists` | Returns `boolean`, never throws on missing key |
| `stat` | Returns `StorageMeta`; throws `StorageKeyNotFoundError` if missing |
| `delete` | Removes file; **no-op** if key does not exist |
| `getPublicUrl` | Returns `{baseUrl}/{key}`; validates key before building URL |
| path traversal | Any key containing `..` throws `StorageKeyError` before filesystem access |

## Test Coverage

```
src/storage/__tests__/local.provider.test.ts

put               — writes, creates nested dirs, bytes round-trip
put (overwrite)   — second content wins, stat reflects new size
get               — returns buffer, throws StorageKeyNotFoundError on miss
exists            — false before write, true after, false after delete
delete            — removes file, no-op on missing, get throws afterward
stat              — sizeBytes, key, lastModified date, throws on miss
invalid keys      — empty, .., leading /, //, trailing /, spaces
nested dirs       — 3-level and 5-level paths, independent keys in same dir
normalizeKey      — strips leading/trailing slash, collapses //, backslashes
buildStorageKey   — canonical pattern, sanitises spaces
getPublicUrl      — default and custom base, rejects invalid key

38 tests, 0 failures
```

## Smoke Command

```bash
pnpm --filter @pcme/media storage:smoke
```

No database or network required. Creates a temp directory, exercises all
provider operations, then cleans up.

## Changed Files

```
packages/media/
  package.json                                      — added vitest, tsx, smoke script
  src/index.ts                                      — export new utilities and types
  src/storage/provider.ts                           — added StorageMeta, stat(), refined docs
  src/storage/key.ts                                — NEW: key validation and build helpers
  src/storage/config.ts                             — NEW: LocalStorageConfig + env loader
  src/storage/local.provider.ts                     — full implementation with stat()
  src/storage/url-resolver.ts                       — unchanged
  src/storage/__tests__/local.provider.test.ts      — NEW: 38-test vitest suite
  src/scripts/storage-smoke.ts                      — NEW: 11-step no-DB smoke

providers/storage/local/
  package.json                                      — added @pcme/media dependency
  src/index.ts                                      — re-export from @pcme/media

docs/sprints/sprint-7-local-storage.md              — this file
```

## Verification Results

```
pnpm --filter @pcme/media test
  ✓ local.provider.test.ts (38 tests) — PASS

pnpm --filter @pcme/media lint
  0 errors — PASS

pnpm build
  26 successful, 26 total — PASS

pnpm --filter @pcme/media storage:smoke
  11 steps — PASS
```

## Recommended Git Commit Message

```
feat(media): implement local storage foundation (Sprint 7)

- StorageProvider interface: put, get, exists, stat, delete, getPublicUrl
- StorageMeta type for stat lookup results
- LocalStorageProvider: full filesystem implementation with path-traversal guard
- StorageKeyError + StorageKeyNotFoundError typed errors
- validateStorageKey / normalizeKey / buildStorageKey utilities
- loadLocalStorageConfig() reads STORAGE_LOCAL_ROOT + STORAGE_BASE_URL
- 38-test vitest suite covering all operations, invalid keys, nested dirs
- storage:smoke script — 11 steps, no database required
- providers/storage/local re-exports from @pcme/media for provider-swap pattern
```
