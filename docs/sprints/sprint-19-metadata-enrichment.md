# Sprint 19 — Metadata Enrichment Layer

## Goal

Create a deterministic metadata enrichment layer that prepares publish-ready metadata without AI or external APIs.

---

## Service

```typescript
import { enrichMetadata } from '@pcme/seo';

const metadata = enrichMetadata({
  title: 'Article Title',
  slug: 'optional-slug',
  body: '<p>HTML or plain text</p>',
  excerpt: 'optional',
  tags: ['tag1'],
  categories: ['category1'],
  image: { width: 1200, height: 800, mimeType: 'image/jpeg' },
});
```

---

## Input fields

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Primary title |
| `body` | Yes | HTML or plain text |
| `slug` | No | Normalized; derived from title if absent |
| `excerpt` | No | Fallback generated from body |
| `tags` | No | Normalized list |
| `categories` | No | Normalized list |
| `image.width/height/mimeType` | No | Enables orientation + alt placeholder |

---

## Output fields (`PublishMetadata`)

| Field | Description |
|---|---|
| `slug` | URL-safe, lowercase, hyphenated |
| `seoTitle` | Title fallback (max 60 chars) |
| `excerpt` | Explicit or body-derived (max 160 chars) |
| `metaDescription` | Excerpt-first, else body (max 155 chars) |
| `readingTimeMinutes` | Word count ÷ 200 wpm |
| `tags` | Lowercase, deduped, sorted |
| `categories` | Lowercase, deduped, sorted |
| `image.orientation` | `landscape` \| `portrait` \| `square` \| `unknown` |
| `image.altText` | Deterministic placeholder: `Image: {title}` |

---

## Deterministic rules

- Same input → same output, always
- No network, no AI, no randomness
- Tags/categories sorted alphabetically after normalization
- Platform-neutral — no WordPress or provider-specific fields

---

## Why AI is deferred

AI enrichment (OpenRouter, captioning, alt text generation) requires:

- External API integration and cost controls
- Non-deterministic output handling
- Prompt/response validation pipelines

Deterministic enrichment must exist first so Sprint 20 can optionally **override** specific fields (e.g. `altText`, `metaDescription`) while preserving fallbacks when AI is unavailable.

---

## Sprint 20 preview

Sprint 20 will add optional AI enrichment on top of this layer:

1. Call `enrichMetadata()` for baseline publish metadata
2. Optionally call AI provider to refine `excerpt`, `metaDescription`, or `altText`
3. Merge AI output over deterministic defaults with explicit precedence rules

---

## Verification

```bash
pnpm --filter @pcme/seo test
pnpm --filter @pcme/seo smoke
pnpm build
```
