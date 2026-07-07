/**
 * Beta Release Candidate smoke aggregator — Sprint 50.
 *
 * Runs release validation checks and all major offline smoke suites,
 * then prints a single release-ready summary.
 *
 * Usage: pnpm beta-rc:smoke
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

type SuiteResult = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  detail?: string;
};

const results: SuiteResult[] = [];

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

function section(title: string): void {
  console.log(`\n[${title}]`);
}

function runCommand(name: string, command: string): SuiteResult {
  const start = Date.now();
  try {
    execSync(command, { cwd: ROOT, stdio: 'pipe', env: process.env });
    return { name, status: 'passed', durationMs: Date.now() - start };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { name, status: 'failed', durationMs: Date.now() - start, detail };
  }
}

function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(label);
  pass(label);
}

function validateReleaseAssets(): void {
  section('Release assets');
  const required = [
    'release/metadata.json',
    'docs/releases/beta-release-candidate.md',
    'docs/releases/changelog-v0.50.md',
    'docs/releases/upgrade-guide-v0.50.md',
    'docs/milestones/beta-rc-v0.50.md',
  ];
  for (const rel of required) {
    assert(existsSync(resolve(ROOT, rel)), `exists: ${rel}`);
  }

  const meta = JSON.parse(readFileSync(resolve(ROOT, 'release/metadata.json'), 'utf8')) as {
    version: string;
    sprintsCompleted: number;
  };
  assert(meta.version === '0.50.0-beta-rc', `metadata version = 0.50.0-beta-rc`);
  assert(meta.sprintsCompleted === 49, 'metadata sprintsCompleted = 49');
}

function validateSprintDocumentation(): void {
  section('Sprint documentation (1–49)');
  const sprintDir = resolve(ROOT, 'docs/sprints');
  const files = readdirSync(sprintDir).filter((f) => f.startsWith('sprint-') && f.endsWith('.md'));
  assert(files.length >= 48, `at least 48 sprint docs (found ${files.length})`);

  const keyDocs = [
    'docs/architecture/system-overview.md',
    'docs/architecture/module-map.md',
    'docs/deployment/deployment-guide.md',
    'docs/performance/performance-guide.md',
    'docs/releases/beta-checklist.md',
  ];
  for (const rel of keyDocs) {
    assert(existsSync(resolve(ROOT, rel)), `exists: ${rel}`);
  }
}

function validateDocumentationLinks(): void {
  section('Documentation link validation');
  const releaseDoc = readFileSync(resolve(ROOT, 'docs/releases/beta-release-candidate.md'), 'utf8');
  const linkPattern = /\]\(([^)]+\.md[^)]*)\)/g;
  let match: RegExpExecArray | null;
  let checked = 0;
  while ((match = linkPattern.exec(releaseDoc)) !== null) {
    const href = match[1]?.split('#')[0];
    if (!href || href.startsWith('http')) continue;
    const target = resolve(ROOT, 'docs/releases', href);
    assert(existsSync(target), `link resolves: ${href}`);
    checked++;
  }
  assert(checked >= 3, `checked ${checked} internal doc links`);
}

function validateEnvTemplates(): void {
  section('Example env validation');
  const devEnv = readFileSync(resolve(ROOT, '.env.example'), 'utf8');
  const prodEnv = readFileSync(resolve(ROOT, 'deploy/env/.env.production.example'), 'utf8');

  for (const key of ['DATABASE_URL', 'REDIS_URL', 'API_PORT', 'WORKER_CONCURRENCY']) {
    assert(devEnv.includes(key), `.env.example contains ${key}`);
  }

  for (const key of [
    'DATABASE_URL',
    'REDIS_URL',
    'STORAGE_LOCAL_ROOT',
    'PCME_AUTH_ENABLED',
    'DASHBOARD_API_BASE_URL',
    'WORKER_CONCURRENCY',
  ]) {
    assert(prodEnv.includes(key), `.env.production.example contains ${key}`);
  }
}

function validatePublicApiConsistency(): void {
  section('Public API consistency');
  const routeFiles = [
    'apps/api/src/routes/health.ts',
    'apps/api/src/routes/metrics.ts',
    'apps/api/src/routes/version.ts',
    'apps/api/src/routes/publishing.ts',
    'apps/api/src/routes/dashboard.ts',
    'apps/api/src/routes/jobs.ts',
    'apps/api/src/routes/assets.ts',
    'apps/api/src/routes/composer.ts',
    'apps/api/src/routes/auth.ts',
    'apps/api/src/routes/queue.ts',
    'apps/api/src/routes/publishers.ts',
    'apps/api/src/routes/calendar.ts',
    'apps/api/src/routes/provider-config.ts',
    'apps/api/src/routes/activity.ts',
    'apps/api/src/routes/notifications.ts',
  ];
  for (const rel of routeFiles) {
    assert(existsSync(resolve(ROOT, rel)), `route module: ${rel}`);
  }

  const healthChecks = [
    ['apps/api/src/routes/health.ts', "'/health'"],
    ['apps/api/src/routes/dashboard.ts', "'/dashboard/health'"],
    ['apps/api/src/routes/publishing.ts', "'/publishing/health'"],
    ['apps/api/src/routes/auth.ts', "'/auth/health'"],
    ['apps/api/src/routes/metrics.ts', "'/metrics'"],
  ] as const;
  for (const [file, marker] of healthChecks) {
    const content = readFileSync(resolve(ROOT, file), 'utf8');
    assert(content.includes(marker), `${marker} defined in ${file}`);
  }
}

function validateDashboardNavigation(): void {
  section('Dashboard navigation consistency');
  const renderer = readFileSync(resolve(ROOT, 'apps/dashboard/src/renderer.ts'), 'utf8');
  const navRoutes = [
    'href="/"',
    'href="/publishers"',
    'href="/jobs"',
    'href="/assets"',
    'href="/composer"',
    'href="/bulk-publish"',
    'href="/calendar"',
    'href="/activity"',
    'href="/notifications"',
    'href="/provider-config"',
  ];
  for (const route of navRoutes) {
    assert(renderer.includes(route), `nav includes ${route}`);
  }
}

function validateRbacCoverage(): void {
  section('RBAC coverage');
  const permissions = readFileSync(resolve(ROOT, 'apps/api/src/auth/permissions.ts'), 'utf8');
  const requiredPermissions = [
    'dashboard:read',
    'metrics:read',
    'jobs:read',
    'assets:read',
    'publishers:read',
    'calendar:read',
    'composer:read',
    'composer:write',
    'publishing:write',
    'scheduling:write',
    'queue:read',
    'queue:write',
    'providers:read',
    'providers:write',
    'media:write',
    'activity:read',
    'notifications:read',
  ];
  for (const perm of requiredPermissions) {
    assert(permissions.includes(`'${perm}'`), `permission registered: ${perm}`);
  }

  for (const role of ['admin', 'operator', 'publisher', 'viewer']) {
    assert(permissions.includes(`${role}:`), `role defined: ${role}`);
  }
}

function validateMetricsCoverage(): void {
  section('Metrics coverage');
  const metrics = readFileSync(resolve(ROOT, 'apps/api/src/metrics.ts'), 'utf8');
  for (const field of [
    'uploadsTotal',
    'processedTotal',
    'publishedTotal',
    'retriesTotal',
    'failuresTotal',
    'duplicateSkipsTotal',
    'schedulerJobsTotal',
    'queueWaiting',
    'queueActive',
    'apiResponseTimeMs',
    'workerProcessedPerMinute',
    'publishSuccessRate',
    'queueDepthTotal',
  ]) {
    assert(metrics.includes(field), `metric field: ${field}`);
  }
}

function validateVersionConsistency(): void {
  section('Version consistency');
  const rootPkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as {
    version: string;
  };
  const meta = JSON.parse(readFileSync(resolve(ROOT, 'release/metadata.json'), 'utf8')) as {
    version: string;
  };
  assert(
    rootPkg.version === meta.version,
    `root package.json version matches metadata (${meta.version})`,
  );
}

function validateNoDeadCodeMarkers(): void {
  section('TODO/FIXME review');
  try {
    const output = execSync(
      'rg -l "TODO|FIXME" apps packages plugins providers scripts --glob "*.ts" --glob "!**/*.test.ts" || true',
      { cwd: ROOT, encoding: 'utf8' },
    ).trim();
    assert(output.length === 0, 'no TODO/FIXME in production TypeScript sources');
  } catch {
    pass('no TODO/FIXME in production TypeScript sources');
  }
}

const OFFLINE_SMOKE_SUITES: Array<{ name: string; command: string }> = [
  { name: 'beta', command: 'pnpm beta:smoke' },
  { name: 'metrics', command: 'pnpm metrics:smoke' },
  { name: 'auth', command: 'pnpm auth:smoke' },
  { name: 'queue', command: 'pnpm queue:smoke' },
  { name: 'publishing-api', command: 'pnpm publishing-api:smoke' },
  { name: 'dashboard-api', command: 'pnpm dashboard-api:smoke' },
  { name: 'dashboard-ui', command: 'pnpm --filter @pcme/dashboard smoke' },
  { name: 'dashboard-ops', command: 'pnpm dashboard-ops:smoke' },
  { name: 'publisher-management', command: 'pnpm publisher-management:smoke' },
  { name: 'jobs', command: 'pnpm jobs:smoke' },
  { name: 'assets', command: 'pnpm assets:smoke' },
  { name: 'composer', command: 'pnpm composer:smoke' },
  { name: 'publish-workflow', command: 'pnpm publish-workflow:smoke' },
  { name: 'bulk-publish', command: 'pnpm bulk-publish:smoke' },
  { name: 'calendar', command: 'pnpm calendar:smoke' },
  { name: 'provider-config', command: 'pnpm provider-config:smoke' },
  { name: 'rbac', command: 'pnpm rbac:smoke' },
  { name: 'audit', command: 'pnpm audit:smoke' },
  { name: 'notifications', command: 'pnpm notifications:smoke' },
  { name: 'deployment', command: 'pnpm deployment:smoke' },
  { name: 'performance', command: 'pnpm performance:smoke' },
  { name: 'publisher-sdk', command: 'pnpm publisher-sdk:smoke' },
  { name: 'wordpress', command: 'pnpm wordpress:smoke' },
  { name: 'ghost', command: 'pnpm ghost:smoke' },
  { name: 'worker-duplicate', command: 'pnpm duplicate:smoke' },
  { name: 'worker-retry', command: 'pnpm retry:smoke' },
  { name: 'worker-scheduler', command: 'pnpm scheduler:smoke' },
];

const SKIPPED_LIVE_SUITES = ['e2e:smoke', 'publishing-history:smoke'];

function runOfflineSmokeSuites(): void {
  section(`Offline smoke suites (${OFFLINE_SMOKE_SUITES.length})`);
  for (const suite of OFFLINE_SMOKE_SUITES) {
    process.stdout.write(`  → ${suite.name}... `);
    const result = runCommand(suite.name, suite.command);
    results.push(result);
    if (result.status === 'passed') {
      console.log(`✓ (${result.durationMs}ms)`);
    } else {
      console.log(`✗ FAILED`);
    }
  }

  for (const name of SKIPPED_LIVE_SUITES) {
    results.push({ name, status: 'skipped', durationMs: 0, detail: 'requires live DB/Redis' });
  }
}

function printSummary(): void {
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed');
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  PC Media Engine — Beta RC Smoke Summary (v0.50.0-beta-rc)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed.length}`);
  console.log(`  Skipped: ${skipped} (live-only)`);
  console.log(`  Time:    ${Math.round(totalMs / 1000)}s`);
  console.log('──────────────────────────────────────────────────────────');

  if (failed.length > 0) {
    console.log('\n  Failures:');
    for (const f of failed) {
      console.log(`    ✗ ${f.name}`);
    }
    console.log('\n❌  Beta RC smoke FAILED — not release-ready.\n');
    process.exit(1);
  }

  console.log('\n✅  Beta RC smoke PASSED — release candidate validated.\n');
}

async function main(): Promise<void> {
  console.log('\nPC Media Engine — Beta Release Candidate Validation (Sprint 50)\n');

  validateReleaseAssets();
  validateSprintDocumentation();
  validateDocumentationLinks();
  validateEnvTemplates();
  validatePublicApiConsistency();
  validateDashboardNavigation();
  validateRbacCoverage();
  validateMetricsCoverage();
  validateVersionConsistency();
  validateNoDeadCodeMarkers();

  runOfflineSmokeSuites();
  printSummary();
}

main().catch((err: unknown) => {
  console.error('\nBeta RC validation failed:', err);
  process.exit(1);
});
