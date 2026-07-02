/**
 * Sprint 6 — Local Smoke Script
 *
 * Proves the end-to-end domain chain using only the database layer:
 *
 *   IngestionJob (seeded)
 *     → Asset (new, linked via ingestionJobId)
 *       → ProcessingJob (canonical, unique per asset + processingType)
 *         → ProcessingJobAttempt 1 (failed — history retained)
 *         → ProcessingJobAttempt 2 (completed — retry under same Job)
 *         → ProcessingArtifact    (storageKeyPlaceholder + storageKey set)
 *
 * Run:   pnpm --filter @pcme/database db:smoke
 * Needs: docker compose up -d && pnpm db:migrate && pnpm db:seed
 */

import { connectDatabase, disconnectDatabase, getPrismaClient } from '../client.js';
import { IngestionJobRepository } from '../repositories/ingestion.repository.js';
import { MediaAssetRepository } from '../repositories/media.repository.js';
import {
  ProcessingArtifactRepository,
  ProcessingJobRepository,
} from '../repositories/processing.repository.js';
import { ProcessingJobAttemptRepository } from '../repositories/processing-attempt.repository.js';

// ---------------------------------------------------------------------------
// Seed constants (must match prisma/seed.ts)
// ---------------------------------------------------------------------------

const ORG_SLUG = 'default-operator';
const PROJECT_SLUG = 'piercingconnect';
const SEEDED_INGESTION_JOB_ID = 'seedpcingestjob001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`  ✗ FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// Smoke
// ---------------------------------------------------------------------------

async function smoke(): Promise<void> {
  await connectDatabase();
  const db = getPrismaClient();

  console.log('\n═══ Sprint 6 Domain Smoke ═══\n');

  // ── 0. Resolve seeded IDs ─────────────────────────────────────────────────
  console.log('▶ Resolving seeded org / project...');

  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`Org "${ORG_SLUG}" not found — run pnpm db:seed first`);

  const project = await db.project.findFirst({
    where: { organizationId: org.id, slug: PROJECT_SLUG },
  });
  if (!project) throw new Error(`Project "${PROJECT_SLUG}" not found — run pnpm db:seed first`);

  const ingestionJob = await new IngestionJobRepository().findById(
    project.id,
    SEEDED_INGESTION_JOB_ID,
  );
  if (!ingestionJob) {
    throw new Error(`IngestionJob "${SEEDED_INGESTION_JOB_ID}" not found — run pnpm db:seed first`);
  }

  console.log(`  org.id      = ${org.id}`);
  console.log(`  project.id  = ${project.id}`);
  console.log(`  ingestJob   = ${ingestionJob.id} (status=${ingestionJob.status})`);

  // ── 1. Create Asset linked to IngestionJob ────────────────────────────────
  console.log('\n▶ Step 1 — Create Asset linked to IngestionJob...');

  const assetRepo = new MediaAssetRepository();
  const assetStorageKey = `${PROJECT_SLUG}/smoke/${Date.now()}-smoke-test.jpg`;

  const asset = await assetRepo.create({
    organizationId: org.id,
    projectId: project.id,
    ingestionJobId: ingestionJob.id,
    filename: 'smoke-test.jpg',
    originalFilename: 'smoke-test.jpg',
    mimeType: 'image/jpeg',
    storageProvider: 'local',
    storageKey: assetStorageKey,
    sizeBytes: 12345,
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'ready',
  });

  assert(asset.ingestionJobId === ingestionJob.id, `Asset.ingestionJobId → ${ingestionJob.id}`);
  assert(asset.storageKey === assetStorageKey, 'Asset.storageKey set');
  console.log(`  asset.id = ${asset.id}`);

  // ── 2. Create canonical ProcessingJob ─────────────────────────────────────
  console.log('\n▶ Step 2 — Create canonical ProcessingJob (unique per asset + type)...');

  const jobRepo = new ProcessingJobRepository();
  const job = await jobRepo.create({
    organizationId: org.id,
    projectId: project.id,
    assetId: asset.id,
    processingType: 'thumbnail',
    priority: 0,
  });

  assert(job.assetId === asset.id, 'Job.assetId → asset');
  assert(job.status === 'pending', 'Job starts pending');
  console.log(`  job.id = ${job.id}`);

  // ── 3. Attempt 1 — start then fail ───────────────────────────────────────
  console.log('\n▶ Step 3 — Attempt 1: start, then fail...');

  const attemptRepo = new ProcessingJobAttemptRepository();
  const attempt1 = await attemptRepo.create({
    organizationId: org.id,
    projectId: project.id,
    processingJobId: job.id,
    attemptNumber: 1,
    status: 'running',
  });

  await attemptRepo.update(project.id, attempt1.id, {
    status: 'failed',
    failureReason: 'simulated transient error',
    completedAt: new Date(),
  });

  // Reflect failure on the parent job
  await jobRepo.update(project.id, job.id, {
    status: 'pending', // back to pending — worker will retry
    failureReason: 'attempt 1 failed: simulated transient error',
  });

  const failedAttempt = await db.processingJobAttempt.findUnique({
    where: { id: attempt1.id },
  });
  assert(failedAttempt?.status === 'failed', 'Attempt 1 status = failed');
  assert(
    failedAttempt?.failureReason === 'simulated transient error',
    'Attempt 1 failure reason preserved',
  );
  console.log(`  attempt1.id = ${attempt1.id} (status=failed, reason preserved)`);

  // ── 4. Attempt 2 — succeed ────────────────────────────────────────────────
  console.log('\n▶ Step 4 — Attempt 2: start, then complete...');

  const nextNum = await attemptRepo.nextAttemptNumber(job.id);
  assert(nextNum === 2, 'nextAttemptNumber returns 2');

  const attempt2 = await attemptRepo.create({
    organizationId: org.id,
    projectId: project.id,
    processingJobId: job.id,
    attemptNumber: nextNum,
    status: 'running',
  });

  await attemptRepo.update(project.id, attempt2.id, {
    status: 'completed',
    completedAt: new Date(),
  });

  console.log(`  attempt2.id = ${attempt2.id} (status=completed)`);

  // ── 5. Mark ProcessingJob completed ──────────────────────────────────────
  console.log('\n▶ Step 5 — Mark ProcessingJob completed (clears failure reason)...');

  await jobRepo.update(project.id, job.id, {
    status: 'completed',
    completedAt: new Date(),
    failureReason: null,
  });

  const completedJob = await jobRepo.findById(project.id, job.id);
  assert(completedJob?.status === 'completed', 'Job.status = completed');
  assert(completedJob?.failureReason === null, 'Job.failureReason cleared on success');

  // ── 6. Create ProcessingArtifact ─────────────────────────────────────────
  console.log('\n▶ Step 6 — Create ProcessingArtifact with real storageKey...');

  const artifactRepo = new ProcessingArtifactRepository();
  const placeholder = `${project.id}/${asset.id}/thumbnail-pending`;
  const artifactKey = `${PROJECT_SLUG}/${asset.id}/smoke-test_thumb.webp`;

  const artifact = await artifactRepo.create({
    organizationId: org.id,
    projectId: project.id,
    processingJobId: job.id,
    assetId: asset.id,
    processingType: 'thumbnail',
    artifactType: 'thumbnail',
    mimeType: 'image/webp',
    storageKeyPlaceholder: placeholder,
    storageKey: artifactKey,
    sizeBytes: 4321,
  });

  assert(artifact.processingJobId === job.id, 'Artifact.processingJobId → canonical job');
  assert(artifact.assetId === asset.id, 'Artifact.assetId → asset');
  assert(artifact.storageKey === artifactKey, `Artifact.storageKey = "${artifactKey}"`);
  assert(
    artifact.storageKeyPlaceholder === placeholder,
    'Artifact.storageKeyPlaceholder preserved as audit trail',
  );

  // ── 7. Verify full chain ──────────────────────────────────────────────────
  console.log('\n▶ Step 7 — Verify full domain chain...');

  const finalAsset = await assetRepo.findById(project.id, asset.id);
  assert(finalAsset?.ingestionJobId === ingestionJob.id, 'IngestionJob → Asset lineage confirmed');

  const allAttempts = await attemptRepo.listByJob(project.id, job.id);
  assert(allAttempts.length === 2, 'Two attempts recorded under one canonical job');
  assert(allAttempts[0]?.status === 'failed', 'Attempt 1 is failed (history retained)');
  assert(allAttempts[1]?.status === 'completed', 'Attempt 2 is completed');

  const artifacts = await artifactRepo.listByJob(project.id, job.id);
  assert(artifacts.length === 1, 'One artifact under the canonical job');
  assert(artifacts[0]?.storageKey === artifactKey, 'Artifact storageKey readable via listByJob');

  // Confirm the unique constraint is intact — a second job for same asset+type must fail
  console.log('\n▶ Step 8 — Confirm unique constraint: second job for same asset+type rejected...');
  let uniqueViolated = false;
  try {
    await jobRepo.create({
      organizationId: org.id,
      projectId: project.id,
      assetId: asset.id,
      processingType: 'thumbnail',
    });
  } catch {
    uniqueViolated = true;
  }
  assert(uniqueViolated, 'Unique constraint on (assetId, processingType) enforced');

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ Smoke PASSED — Sprint 6 domain chain verified            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  IngestionJob  ${ingestionJob.id}`);
  console.log(`       │`);
  console.log(`  Asset         ${asset.id}`);
  console.log(`       │         storageKey=${asset.storageKey}`);
  console.log(`       │`);
  console.log(`  ProcessingJob ${job.id}  status=completed  [CANONICAL, unique per asset+type]`);
  console.log(`       ├── Attempt 1  ${attempt1.id}  status=failed   (history retained)`);
  console.log(`       ├── Attempt 2  ${attempt2.id}  status=completed`);
  console.log(`       └── Artifact   ${artifact.id}`);
  console.log(`                       placeholder=${artifact.storageKeyPlaceholder}`);
  console.log(`                       storageKey =${artifact.storageKey}`);
  console.log('');

  await disconnectDatabase();
}

smoke().catch((err: unknown) => {
  console.error('\n❌ Smoke FAILED:', err);
  process.exit(1);
});
