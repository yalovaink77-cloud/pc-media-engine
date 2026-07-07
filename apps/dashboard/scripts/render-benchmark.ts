/**
 * Dashboard render benchmark — Sprint 49.
 *
 * Times HTML rendering for key list pages using fixture data.
 * Fully offline — no API or network required.
 *
 * Usage:
 *   pnpm exec tsx scripts/render-benchmark.ts --offline
 */

import { renderAssetsPage, renderJobsPage, renderNotificationsPage } from '../src/renderer.js';
import type { AssetListItem, JobListItem, NotificationItem } from '../types.js';

const ITERATIONS = 25;

function bench(label: string, fn: () => string): { label: string; avgMs: number } {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { label, avgMs: Math.round(avg * 100) / 100 };
}

function makeJobs(count: number): JobListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `job-${i}`,
    name: 'publish',
    status: 'waiting',
    publisher: 'wordpress',
    projectId: 'proj-1',
    assetId: `asset-${i}`,
    title: `Article ${i}`,
    slug: `article-${i}`,
    retryCount: 0,
    maxAttempts: 3,
    createdAt: new Date().toISOString(),
  }));
}

function makeAssets(count: number): AssetListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `asset-${i}`,
    projectId: 'proj-1',
    filename: `file-${i}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    status: 'ready',
    publisherCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

function makeNotifications(count: number): NotificationItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${i}`,
    type: 'publish.success',
    category: 'publishing',
    severity: 'info' as const,
    title: `Event ${i}`,
    message: 'Published successfully',
    read: i % 3 === 0,
    createdAt: new Date().toISOString(),
  }));
}

async function main(): Promise<void> {
  const now = new Date().toISOString();
  const limit = 50;

  const results = [
    bench('jobs page', () =>
      renderJobsPage({
        result: { jobs: makeJobs(limit), total: limit, limit, offset: 0 },
        filters: { limit, offset: 0 },
        fetchedAt: now,
        errors: [],
        apiKeyConfigured: true,
      }),
    ),
    bench('assets page', () =>
      renderAssetsPage({
        result: { assets: makeAssets(limit), total: limit, limit, offset: 0 },
        filters: { limit, offset: 0 },
        fetchedAt: now,
        errors: [],
        apiBaseUrl: 'http://127.0.0.1:3001',
      }),
    ),
    bench('notifications page', () =>
      renderNotificationsPage({
        notifications: {
          notifications: makeNotifications(limit),
          unreadCount: 10,
          total: limit,
          limit,
        },
        selectedNotification: null,
        showUnreadOnly: false,
        fetchedAt: now,
        errors: [],
      }),
    ),
  ];

  console.log(`\nDashboard render benchmark (n=${ITERATIONS}, ${limit}-row fixtures):\n`);
  for (const r of results) {
    console.log(`  ${r.label.padEnd(20)} avg=${r.avgMs}ms`);
  }
  console.log('');
}

main().catch((err: unknown) => {
  console.error('Render benchmark failed:', err);
  process.exit(1);
});
