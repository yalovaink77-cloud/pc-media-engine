# Organization & Project Workspace Model

## Hierarchy

```
Organization          ← billing, RBAC, quotas (future SaaS tenant)
  └── Project         ← site/brand (PiercingConnect, Lumora, …)
        ├── ContentItem
        ├── Asset
        ├── PublishingOutboxEntry
        ├── PublishRecord
        ├── AnalyticsSnapshot
        └── Integrations (WordPress, BMC, affiliate)
```

## Organization Entity

```typescript
interface Organization {
  id: string;
  slug: string;
  name: string;
  plan?: string; // future SaaS tier
  createdAt: Date;
  updatedAt: Date;
}
```

## Project Entity

```typescript
interface Project {
  id: string;
  organizationId: string; // REQUIRED
  slug: string;
  name: string;
  domain?: string;
  voiceProfile: string;
  enabledContentTypes: ContentType[];
  aiConfig: AiProviderConfig;
  storageConfig: StorageProviderConfig;
  publishingConfig: { wordpress?: WordPressConfig };
  monetizationConfig: {
    buyMeACoffee?: { username: string };
    amazonAffiliate?: { tag: string; region: string };
  };
  seoDefaults: { titleSuffix?: string; defaultOgImage?: string };
  createdAt: Date;
  updatedAt: Date;
}
```

## Isolation Rules

1. Queries always filter by `projectId` from authenticated context.
2. `organizationId` denormalized on child entities for future RLS.
3. Cross-project asset sharing forbidden without explicit copy workflow.
4. Internal link suggestions search within same project only.
5. AI prompts override per project via `voiceProfile`.
6. Each project selects its own AI and storage provider.

## SaaS Preparation (not MVP)

| Concern        | Sprint 0 / MVP       | Future                              |
| -------------- | -------------------- | ----------------------------------- |
| Multi-org auth | Single operator org  | Org-scoped login                    |
| RBAC           | Implicit full access | owner / editor / publisher / viewer |
| Quotas         | None enforced        | storage, AI tokens, publish rate    |
| Billing        | None                 | Stripe per Organization             |
| Data isolation | App-level filter     | Postgres RLS                        |

## PiercingConnect Configuration

```yaml
organization:
  slug: default-operator
  name: Default Operator

project:
  organizationSlug: default-operator
  slug: piercingconnect
  name: PiercingConnect
  domain: piercingconnect.com
  voiceProfile: >
    Clinical but approachable. Safety-first. Explain risks without fear-mongering.
    Never provide medical diagnosis. Encourage professional piercer consultation.

  enabledContentTypes:
    - guide
    - faq
    - aftercare-card
    - printable
    - affiliate-section
    - bmc-block

  aiConfig:
    provider: claude
    defaultModel: claude-sonnet-4-20250514

  storageConfig:
    provider: local
    root: ./data/media/piercingconnect

  publishingConfig:
    wordpress:
      siteUrl: https://piercingconnect.com
      seoPlugin: yoast

  monetizationConfig:
    buyMeACoffee:
      username: TBD
    amazonAffiliate:
      tag: TBD
      region: us

  seoDefaults:
    titleSuffix: "| PiercingConnect"
```

## Initial Content Catalog

| Priority | Type              | Topic                                  |
| -------- | ----------------- | -------------------------------------- |
| P0       | guide             | Piercing safety basics                 |
| P0       | aftercare-card    | Navel / ear / nose aftercare printable |
| P0       | guide             | Piercing bump vs granuloma vs keloid   |
| P1       | faq               | General piercing FAQ hub               |
| P1       | guide             | How to clean a new piercing            |
| P1       | affiliate-section | Recommended saline spray products      |
| P2       | bmc-block         | Site-wide support CTA template         |
| P2       | printable         | PDF aftercare card download            |

## Content Templates

### Safety Guide

H1 with focus keyword · Key takeaways · What it is · Risks · Aftercare summary · When to see a professional · FAQ block · Optional affiliate · BMC footer

### Aftercare Card

Single-page printable · Do/Don't · Cleaning steps · Warning signs · Link to full guide

## Multi-Project Dashboard

- Project switcher in nav
- API middleware resolves Organization + Project from session
- Worker jobs include `projectId` in payload

## Audit Log (cross-reference)

All significant project actions logged: content created/updated, lifecycle changed, media uploaded, publish attempted/succeeded/failed, integration changed. See module-map and engineering principles.
