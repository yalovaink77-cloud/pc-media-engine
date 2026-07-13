# Production Handoff Review

**Date:** 2026-07-13 (defects resolved)  
**Scope:**
- `plugins/wordpress/src/`
- `packages/publishing/src/handoff/`
- `packages/pilot-piercingconnect/src/run-pilot-acceptance.ts`

**Method:** Static inspection of scoped paths; package tests only (no full acceptance, no full CI).

## Tests Run

```bash
pnpm --filter @pcme/pilot-piercingconnect test   # 10 files, 43 passed
pnpm --filter @pcme/plugin-wordpress test        # 7 files, 175 passed
```

## Verification Matrix

| # | Claim | Classification | Verdict |
|---|-------|----------------|---------|
| 1 | WordPress adapter always forces draft in the pilot path | **resolved** (pilot gate) | Holds for pilot |
| 2 | No public publish without explicit human action | intentional design + pilot-only limitation | Mixed (unchanged) |
| 3 | Acceptance runner does not bypass the real approval contract | **pilot-only limitation** | Unchanged |
| 4 | Handoff metadata derived from active artifact/plan | **pilot-only limitation** | Unchanged |
| 5 | Final revision artifact sanitized/prepared before handoff | **resolved** | Holds |
| 6 | Resolved source records do not incorrectly trigger missing-citation warnings | **false finding** | Holds |
| 7 | Credentials, content, prompts, absolute paths never logged | **intentional design** | Holds |

---

## Resolved Confirmed Defects

### Defect 1 — Pilot WordPress draft safety — **resolved**

**Fix:** `wordpress-draft-safety.ts` fail-closed gate.

- `requirePilotWordPressForceDraft()` rejects anything other than `forceDraft: true`.
- `resolvePilotPublishingTargetAdapter()` requires that gate when `targetId === 'wordpress'`.
- `assertPilotDraftPublishStatus()` refuses non-`draft` publish status in the pilot path.
- Generic `WordPressPublishingTargetAdapter` default is **unchanged** (`forceDraft` still defaults to `false` outside the pilot).

**Evidence:** `wordpress-draft-safety.ts`; `run-pilot-acceptance.ts`; pilot-acceptance tests for reject/accept.

### Defect 2 — Final artifact preparation — **resolved**

**Fix:** `prepareActiveArtifactForHandoff()` runs `preparePublicationDraft()` on the active revision content and returns a new frozen artifact clone before `createPublishingHandoff()`.

- Same `artifactId` / `jobId` / lineage fields preserved.
- Prior and active source artifacts are not mutated.
- Handoff markdown and `wordpress-draft.md` use the prepared content.
- Approval contract unchanged.

**Evidence:** `run-pilot-acceptance.ts` (`prepareActiveArtifactForHandoff`); pilot-acceptance preparation test.

---

## Remaining Pilot-Only Limitations (not defects)

1. Acceptance still uses `FakePublishingTargetAdapter` by default (no live WordPress).
2. Acceptance still auto-approves with hardcoded `pilot-reviewer` when blockers are clear.
3. Handoff title/slug/excerpt remain NeilMed-hardcoded.

## Intentional Design

1. Handoff creation requires approved / approved-with-notes review.
2. Safe handoff logging meta excludes credentials, body, prompts, and absolute paths.
3. Pilot acceptance keeps `published: false` and requests `publishStatus: 'draft'`.

## False Findings

1. Missing `packages/publishing-wordpress` (actual: `plugins/wordpress`).
2. Handoff incorrectly generating `missing-citation-placeholders` from resolved source records (forwards upstream warnings only).
