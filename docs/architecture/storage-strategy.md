# Storage Strategy

## Goal

Store binary media behind a `StorageProvider` interface. MVP uses local filesystem; production switches to S3, Cloudflare R2, or Google Drive without changing `packages/media`.

## StorageProvider Interface

```typescript
interface StoredObject {
  key: string;
  url: string; // resolved by MediaUrlResolver, not StorageProvider
  sizeBytes: number;
  mimeType: string;
  checksum?: string;
}

interface UploadOptions {
  projectId: string;
  filename: string;
  mimeType: string;
  metadata?: Record<string, string>;
}

interface StorageProvider {
  readonly name: "local" | "s3" | "cloudflare-r2" | "google-drive";
  upload(
    stream: Readable | Buffer,
    options: UploadOptions,
  ): Promise<StoredObject>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  getSignedUrl?(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
```

## Key Naming Convention

```
{projectSlug}/{assetId}/{sanitizedFilename}
```

Example: `piercingconnect/clm123abc/navel-aftercare-guide.pdf`

## MediaUrlResolver (required)

Business logic, renderers, and publishers MUST NEVER use raw storage keys, filesystem paths, or provider-specific URLs.

```typescript
type UrlPurpose = "public" | "private" | "signed" | "temporary";

interface ResolvedMediaUrl {
  url: string;
  purpose: UrlPurpose;
  expiresAt?: Date;
  assetId: string;
}

interface MediaUrlResolver {
  resolve(
    assetId: string,
    purpose: UrlPurpose,
    options?: { ttlSeconds?: number },
  ): Promise<ResolvedMediaUrl>;
  resolveMany(
    assetIds: string[],
    purpose: UrlPurpose,
  ): Promise<ResolvedMediaUrl[]>;
}
```

| Purpose     | Use case                | Local MVP        | Cloud          |
| ----------- | ----------------------- | ---------------- | -------------- |
| `public`    | Published HTML embed    | API proxy URL    | CDN URL        |
| `private`   | Dashboard preview       | Auth-gated route | Signed URL     |
| `signed`    | WordPress upload source | HMAC token URL   | Pre-signed URL |
| `temporary` | Worker fetch            | Internal URL     | Pre-signed GET |

### Rules

1. `StorageProvider` stores and retrieves bytes only.
2. `MediaUrlResolver` is the only component that forms URLs per provider.
3. Never persist resolved URLs in content — persist `assetId` references; resolve at render time.
4. Migrating local → R2 changes resolver + storage config; renderers unchanged.

## Local Provider (MVP)

| Setting       | Default                     |
| ------------- | --------------------------- |
| Root          | `./data/media`              |
| Public access | API-served route with token |
| Max upload    | 50 MB (configurable)        |

## Future Providers

- **S3** — `providers/storage/s3`
- **Cloudflare R2** — S3-compatible API, `providers/storage/cloudflare-r2`
- **Google Drive** — Phase 3, lower priority

## Database vs Blob Storage

| PostgreSQL                         | Blob provider   |
| ---------------------------------- | --------------- |
| Asset metadata (tags, alt, rights) | File bytes      |
| Content markdown / blocks          | —               |
| Thumbnail refs                     | Thumbnail files |

## Derivatives

Worker generates on upload: image thumbs (400px, 1200px), PDF first-page preview. Stored alongside original; reproducible from source.

## Soft Delete

`Asset.deletedAt` set on delete; blobs retained 30 days; hard delete via background job.

## Migration Path (local → cloud)

1. Add new provider config to project.
2. Migration job: copy blobs, verify checksum, update `Asset.storageKey`.
3. Switch config; delete local after verification TTL.

## Security

- MIME allowlist: `image/*`, `application/pdf`, `video/mp4`, `audio/mpeg`
- Never expose storage root directly; serve through API
- Signed URLs for non-public assets

## Retention

See data growth policy in [../decisions/004-known-risks-before-sprint-1.md](../decisions/004-known-risks-before-sprint-1.md) and engineering principles. Millions of assets require indexing strategy and archival — planned for scale sprints.
