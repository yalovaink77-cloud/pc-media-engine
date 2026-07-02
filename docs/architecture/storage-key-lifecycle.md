# Storage Key Lifecycle

> Resolves the architecture review finding: "Placeholder is not an architecture; it is a deferral with no resolution date."

## Two keys, two purposes

The system uses two distinct string columns for storage references:

| Column | Table | Meaning |
|---|---|---|
| `storage_key` | `assets` | The **live key** for the asset binary. Set at upload time. Never null after creation. |
| `storage_key_placeholder` | `processing_artifacts` | A **template string** recording what key the artifact *should* have when produced. Set at job creation time. Always non-null. |
| `storage_key` | `processing_artifacts` | The **live key** for the artifact binary. Null until the worker writes the file, then set via `ProcessingArtifactRepository.finalise()`. |

## Asset storageKey

```
{projectSlug}/{assetId}/{safeFilename}
```

**Lifecycle:**

1. API pre-generates `assetId` using `cuid2`.
2. API writes binary to `StorageProvider.put(storageKey, ...)`.
3. API creates `Asset` record with the real `storageKey` (status: `ready`).
4. The key never changes. Deletes call `StorageProvider.delete(storageKey)`.
5. `MediaUrlResolver.resolve(storageKey)` produces the public URL.

There is no placeholder stage for the asset itself. The file is written before the DB record.

## Artifact storageKeyPlaceholder

A naming **convention** defined at job creation time, before any file exists:

```
{projectId}/{assetId}/{artifactType}-pending
```

**Purpose:** Gives the worker an agreed-upon key pattern. The worker may
derive the real key from it or construct one independently.

**Lifecycle:**

1. `ProcessingJobRepository.create()` triggers `ProcessingArtifactRepository.create()` (optionally).
2. `storageKeyPlaceholder` is written at artifact creation with `storageKey = null`.
3. Worker produces the file and calls `ProcessingArtifactRepository.finalise(artifactId, { storageKey, ... })`.
4. `storageKey` is now set. `storageKeyPlaceholder` is retained as audit trail — it shows what was intended vs what was written.

## Resolving a thumbnail URL

```typescript
const artifact = await artifactRepo.findById(projectId, artifactId);
const url = resolver.resolve(artifact?.storageKey); // null if worker hasn't finished
```

## Provider abstraction

Both asset and artifact keys are opaque strings to the API and worker.
`StorageProvider.getPublicUrl(key)` converts them to URLs. The same key
string works across `LocalStorageProvider` (Sprint 6) and any future
S3/GCS implementation — the key format does not change, only the URL shape.
