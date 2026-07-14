# PiercingConnect Content Operations

**Version:** 1.0  
**Status:** Operational system design  
**Scope:** Lifecycle management for evergreen, commercial, news, and social content

This directory defines how PiercingConnect plans, tracks, reviews, publishes, maintains, and retires content. It is subordinate to:

- `docs/editorial/piercingconnect-editorial-style-guide.md`
- `docs/editorial/evergreen-content-master-plan.md`
- `docs/revenue/revenue-roadmap-v1.md`
- `docs/platforms/*-playbook.md`

This is **not** application code. It is the shared operational model editors, reviewers, and future automation must follow.

---

## Purpose

Content Operations gives every PiercingConnect asset a single **content card**—a structured record that answers:

- What is this content?
- Why does it exist (business and reader purpose)?
- Where does it publish?
- What is its editorial and commercial context?
- Who owns it?
- What stage of the lifecycle is it in?

One verified knowledge source (usually a WordPress canonical article) may spawn platform adaptations. Each adaptation gets its own card linked to the canonical parent.

---

## Directory structure

```
content-operations/
├── README.md                          ← This file
├── schemas/
│   └── content-card.schema.yaml       ← Field definitions and validation rules
├── templates/
│   └── content-card.template.yaml     ← Blank card for new entries
└── docs/
    └── workflow.md                    ← Lifecycle stages, transitions, roles
```

Cards are stored as individual YAML files in a registry location defined by editorial leadership (outside this design document). This repository holds the schema, template, and workflow only.

---

## Content card overview

Each card tracks one content asset through its lifecycle using the fields defined in `schemas/content-card.schema.yaml`. Required fields include:

| Field | Role |
|-------|------|
| `id` | Unique identifier |
| `title` | Working or published title |
| `content_type` | Asset format and editorial class |
| `pillar` | Strategic pillar alignment |
| `search_intent` | Primary reader/search goal |
| `evergreen` | Whether the asset is durable or time-bound |
| `platforms` | Target publish surfaces |
| `affiliate_relevance` | Commercial relationship context |
| `related_products` | Linked product records |
| `related_articles` | Internal link graph |
| `update_frequency` | Scheduled review cadence |
| `priority` | Production queue order |
| `status` | Current lifecycle stage |
| `owner` | Accountable editor |
| `notes` | Free-form operational context |

Copy `templates/content-card.template.yaml` when creating a new card.

---

## Lifecycle stages

| Status | Meaning |
|--------|---------|
| **Backlog** | Approved for production; not yet assigned or started |
| **Production** | Drafting or adapting from verified source |
| **Human Review** | Awaiting editorial, safety, or commercial approval |
| **Scheduled** | Approved; publish date assigned |
| **Published** | Live on assigned platform(s) |
| **Update Queue** | Due for scheduled or triggered refresh |
| **Retirement** | Slated for archive, merge, or redirect |

Full transition rules, roles, and gates are in `docs/workflow.md`.

---

## Content classes

The system supports four primary content classes:

| Class | Examples | Canonical home |
|-------|----------|----------------|
| **Evergreen** | Aftercare hubs, educational spokes, terminology guides | WordPress |
| **Commercial** | Product reviews, comparisons, decision guides | WordPress |
| **News** | Formulation changes, guidance updates, safety notices | WordPress (may merge to evergreen) |
| **Social** | Carousels, threads, Reels scripts, pins | Platform-native; links to canonical |

Social cards must reference a parent canonical card unless the asset is purely operational (e.g., trust announcement with no article equivalent).

---

## Relationship to publishing

```
Content card (planning record)
        ↓
Canonical article (WordPress) — source of truth
        ↓
Platform adaptation cards (social, video, pin)
        ↓
Published + maintained per update_frequency
```

Affiliate integration, internal linking, and human approval gates apply at every stage. See `docs/workflow.md` and the Editorial Style Guide.

---

## Governance

- Schema changes require editorial leadership approval.
- Cards may not skip **Human Review** for public publish.
- **Retirement** requires a documented successor or redirect target when the asset was indexed or linked commercially.
- Automation (future) must read cards and enforce status transitions; it must not bypass schema required fields or approval gates.

---

## Quick start

1. Read `docs/workflow.md` for lifecycle rules.
2. Copy `templates/content-card.template.yaml` to your card registry.
3. Assign a unique `id` and set `status: backlog`.
4. Complete required fields before moving to **Production**.
5. Link `related_articles` and `related_products` before **Scheduled**.
6. Set `update_frequency` before **Published**.
