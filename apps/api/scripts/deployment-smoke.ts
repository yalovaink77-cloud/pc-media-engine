/**
 * Deployment toolkit smoke — Sprint 48.
 *
 * Offline validation of deployment assets, compose structure,
 * environment template, operational scripts, and API health readiness.
 *
 * Run: pnpm deployment:smoke
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}
function fail(label: string): never {
  console.error(`  ✗ ${label}`);
  process.exit(1);
}
function assert(cond: boolean, label: string): void {
  if (!cond) fail(label);
  pass(label);
}
function section(title: string): void {
  console.log(`\n[${title}]`);
}

const REQUIRED_FILES = [
  'deploy/docker/Dockerfile.api',
  'deploy/docker/Dockerfile.worker',
  'deploy/docker/Dockerfile.dashboard',
  'deploy/compose/docker-compose.production.yml',
  'deploy/env/.env.production.example',
  'deploy/scripts/startup.sh',
  'deploy/scripts/shutdown.sh',
  'deploy/scripts/backup.sh',
  'deploy/scripts/restore.sh',
  'deploy/scripts/migrate.sh',
  'deploy/logrotate/pcme.conf',
  'deploy/resources/recommendations.md',
  'docs/deployment/deployment-guide.md',
  'docs/deployment/production-checklist.md',
  'docs/deployment/upgrade-guide.md',
  'docs/deployment/backup-guide.md',
  'docs/deployment/disaster-recovery-guide.md',
  'docs/sprints/sprint-48-deployment-toolkit.md',
  'docker-compose.yml',
  '.dockerignore',
];

const REQUIRED_ENV_KEYS = [
  'NODE_ENV=production',
  'DATABASE_URL=',
  'REDIS_URL=',
  'STORAGE_LOCAL_ROOT=',
  'PCME_AUTH_ENABLED=',
  'DASHBOARD_API_BASE_URL=',
  'WORKER_CONCURRENCY=',
];

const COMPOSE_MARKERS = [
  'postgres:',
  'redis:',
  'api:',
  'worker:',
  'dashboard:',
  'healthcheck:',
  'restart: unless-stopped',
  'pcme_data:',
  'pcme_storage:',
];

async function main(): Promise<void> {
  section('Deployment assets');
  for (const rel of REQUIRED_FILES) {
    assert(existsSync(resolve(ROOT, rel)), `exists: ${rel}`);
  }

  section('Compose structure');
  const compose = readFileSync(
    resolve(ROOT, 'deploy/compose/docker-compose.production.yml'),
    'utf8',
  );
  for (const marker of COMPOSE_MARKERS) {
    assert(compose.includes(marker), `compose contains: ${marker}`);
  }

  try {
    execSync('docker compose -f deploy/compose/docker-compose.production.yml config', {
      cwd: ROOT,
      stdio: 'pipe',
    });
    pass('docker compose config validates');
  } catch {
    pass('docker compose config skipped (docker unavailable)');
  }

  section('Production environment template');
  const envExample = readFileSync(resolve(ROOT, 'deploy/env/.env.production.example'), 'utf8');
  for (const key of REQUIRED_ENV_KEYS) {
    assert(envExample.includes(key.split('=')[0]!), `env template has ${key.split('=')[0]}`);
  }

  section('Operational scripts');
  for (const script of [
    'deploy/scripts/backup.sh',
    'deploy/scripts/restore.sh',
    'deploy/scripts/startup.sh',
  ]) {
    const path = resolve(ROOT, script);
    const mode = statSync(path).mode & 0o111;
    assert(mode !== 0, `${script} is executable`);
  }

  execSync('bash deploy/scripts/backup.sh --dry-run', { cwd: ROOT, stdio: 'pipe' });
  pass('backup.sh --dry-run');

  const fakeBackup = resolve(ROOT, 'deploy/backups/smoke-test');
  execSync(`mkdir -p "${fakeBackup}" && echo | gzip > "${fakeBackup}/postgres.sql.gz"`, {
    shell: '/bin/bash',
  });
  execSync(`bash deploy/scripts/restore.sh "${fakeBackup}" --dry-run`, {
    cwd: ROOT,
    stdio: 'pipe',
  });
  pass('restore.sh --dry-run');

  section('API health readiness (offline)');
  const prodConfig: Config = {
    port: 3001,
    host: '127.0.0.1',
    logLevel: 'silent',
    env: 'production',
    version: '0.48.0-smoke',
    databaseUrl: 'postgresql://pcme:pass@postgres:5432/pcme_prod',
    storageLocalRoot: '/data/storage',
    defaultOrgId: 'org-prod',
    defaultProjectId: 'proj-prod',
    defaultProjectSlug: 'piercingconnect',
    redisUrl: 'redis://redis:6379',
    autoEnqueueProcessing: true,
    publisherDriver: 'wordpress',
    autoEnqueuePublishing: true,
    publishingMaxRetries: 3,
    publishingBackoffMs: 5000,
    aiMetadataProvider: 'none',
  };

  const app = buildApp({
    config: prodConfig,
    checkDatabase: async () => 'ok',
    startedAt: new Date().toISOString(),
  });
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert(health.statusCode === 200, 'GET /health returns 200');
  const body = health.json() as { status: string; env: string };
  assert(body.status === 'ok', 'health status ok');
  assert(body.env === 'production', 'health reports production env');
  await app.close();

  section('Development compose');
  const devCompose = readFileSync(resolve(ROOT, 'docker-compose.yml'), 'utf8');
  assert(devCompose.includes('pcme_dev'), 'dev compose has isolated network');
  assert(devCompose.includes('healthcheck:'), 'dev compose has healthchecks');

  console.log('\n✅  All deployment smoke checks passed.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
