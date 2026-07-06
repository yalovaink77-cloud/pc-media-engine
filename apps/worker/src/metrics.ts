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

  inc(key: keyof WorkerMetricCounters, by = 1): void {
    this.counters[key] += by;
  }

  snapshot(): Readonly<WorkerMetricCounters> {
    return { ...this.counters };
  }

  reset(): void {
    this.counters = { ...ZERO };
  }
}
