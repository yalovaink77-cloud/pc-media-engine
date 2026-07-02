# MetadataRecord — EAV Query Patterns

> Resolves the architecture review finding: "Accept the EAV and add a materialized view strategy with explicit documentation of which queries are supported."

## Why EAV was kept

The `metadata_records` table uses an Entity–Attribute–Value (EAV) layout
(`asset_id`, `namespace`, `key`, `value: jsonb`). This was kept over typed
JSONB columns because:

- Metadata domains are not yet stable. Locking into `image_metadata`,
  `audio_metadata`, and `document_metadata` columns before real data is
  ingested risks premature normalization.
- EAV is acceptable for metadata volumes expected in Sprint 6 (< 10k rows/project).
- The escape hatch is a materialized view, documented below.

## Schema constraints

```sql
UNIQUE (asset_id, namespace, key)
INDEX  (project_id)
INDEX  (asset_id, namespace)
```

## Supported query patterns

### 1. Get all metadata for an asset

```typescript
await metadataRepo.findByAsset(projectId, assetId);
// → MetadataRecord[]  (ordered by namespace, key)
```

SQL: `WHERE asset_id = $1 AND project_id = $2`

Supported by index on `(asset_id, namespace)`. ✅

---

### 2. Get metadata in a specific namespace for an asset

```typescript
await metadataRepo.findByAssetNamespace(projectId, assetId, 'exif');
// → MetadataRecord[]
```

SQL: `WHERE asset_id = $1 AND namespace = $2`

Supported by the composite index. ✅

---

### 3. Get a single metadata value

```typescript
await metadataRepo.upsert({ ..., namespace: 'exif', key: 'width', value: 1920 });
// unique constraint guarantees at-most-one
```

SQL: `WHERE asset_id = $1 AND namespace = $2 AND key = $3`

Hit by the unique index. ✅

---

### 4. Filter assets by metadata value (⚠ expensive)

```sql
SELECT DISTINCT asset_id
FROM metadata_records
WHERE project_id = $1
  AND namespace  = 'exif'
  AND key        = 'camera_make'
  AND value      = '"Canon"'::jsonb;
```

**Not indexed.** This performs a sequential scan over `metadata_records`
filtered by `project_id`. For large projects this will be slow.

**Mitigation plan (implement when needed):**

```sql
-- GIN index on the value column for jsonb operators
CREATE INDEX metadata_records_value_gin_idx
  ON metadata_records USING GIN (value jsonb_path_ops);

-- This enables:
WHERE value @@ '$ == "Canon"'
```

---

### 5. Asset metadata pivot (e.g. CSV export) — use a materialized view

When the product needs a "flat" metadata view across multiple keys:

```sql
CREATE MATERIALIZED VIEW asset_metadata_flat AS
SELECT
  mr.project_id,
  mr.asset_id,
  MAX(CASE WHEN mr.namespace = 'exif' AND mr.key = 'width'        THEN mr.value #>> '{}' END) AS exif_width,
  MAX(CASE WHEN mr.namespace = 'exif' AND mr.key = 'height'       THEN mr.value #>> '{}' END) AS exif_height,
  MAX(CASE WHEN mr.namespace = 'exif' AND mr.key = 'camera_make'  THEN mr.value #>> '{}' END) AS exif_camera_make,
  MAX(CASE WHEN mr.namespace = 'file' AND mr.key = 'duration_ms'  THEN mr.value #>> '{}' END) AS file_duration_ms
FROM metadata_records mr
GROUP BY mr.project_id, mr.asset_id
WITH DATA;

CREATE UNIQUE INDEX ON asset_metadata_flat (project_id, asset_id);

-- Refresh on a schedule or after ingestion batch
REFRESH MATERIALIZED VIEW CONCURRENTLY asset_metadata_flat;
```

**When to implement the materialized view:**

- When the dashboard requires browsing assets by metadata facets.
- When a report or export needs columns from multiple metadata keys.
- When query time for pattern 4 exceeds 200ms in production data.

## Upgrade path

If the EAV becomes a real bottleneck before the materialized view suffices,
migrate to typed JSONB columns on `Asset` directly:

```sql
ALTER TABLE assets
  ADD COLUMN image_metadata  JSONB,
  ADD COLUMN audio_metadata  JSONB,
  ADD COLUMN document_metadata JSONB;

CREATE INDEX ON assets USING GIN (image_metadata);
CREATE INDEX ON assets USING GIN (audio_metadata);
CREATE INDEX ON assets USING GIN (document_metadata);
```

Then backfill from `metadata_records` grouped by namespace and drop the EAV table.
This migration is non-breaking (old columns remain until all reads are migrated).
