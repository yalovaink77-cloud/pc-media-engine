/**
 * In-process metrics store for the publishing worker.
 *
 * Tracks worker-side events: publishes, retries, failures, duplicate skips,
 * and scheduler (delayed) job enqueues.
 * Counters reset on process restart; no external dependencies.
 *
 * Mirrors the MetricCounters shape from apps/api/src/metrics.ts so that
 * future consolidation (e.g. via Redis or a shared package) is straightforward.
 */

export type WorkerMetricCounters = {
  processedTotal: number;
  publishedTotal: number;
  retriesTotal: number;
  failuresTotal: number;
  duplicateSkipsTotal: number;
  schedulerJobsTotal: number;
};

export type WorkerMetricsSnapshot = WorkerMetricCounters & {
  processedPerMinute: number;
  publishSuccessRate: number;
};

const ZERO: WorkerMetricCounters = {
  processedTotal: 0,
  publishedTotal: 0,
  retriesTotal: 0,
  failuresTotal: 0,
  duplicateSkipsTotal: 0,
  schedulerJobsTotal: 0,
};

export class WorkerMetricsService {
  private counters: WorkerMetricCounters = { ...ZERO };
  private readonly startedAtMs: number;

  constructor(startedAt?: string | Date) {
    const parsed = startedAt ? new Date(startedAt).getTime() : Date.now();
    this.startedAtMs = Number.isNaN(parsed) ? Date.now() : parsed;
  }

  inc(key: keyof WorkerMetricCounters, by = 1): void {
    this.counters[key] += by;
  }

  snapshot(): WorkerMetricsSnapshot {
    const uptimeMinutes = Math.max((Date.now() - this.startedAtMs) / 60_000, 1 / 60);
    const publishAttempts = this.counters.publishedTotal + this.counters.failuresTotal;
    return {
      ...this.counters,
      processedPerMinute: Math.round((this.counters.processedTotal / uptimeMinutes) * 100) / 100,
      publishSuccessRate:
        publishAttempts > 0
          ? Math.round((this.counters.publishedTotal / publishAttempts) * 10_000) / 100
          : 100,
    };
  }

  reset(): void {
    this.counters = { ...ZERO };
  }
}
