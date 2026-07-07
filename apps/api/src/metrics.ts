/**
 * In-process metrics store for the API server.
 *
 * Counters are incremented by route hooks and reset only on process restart.
 * Queue gauges (waiting/active/completed/failed) are populated by an optional
 * BullMQ introspection function injected at startup.
 *
 * Sprint 49 adds derived performance fields on snapshot():
 *   apiResponseTimeMs, workerProcessedPerMinute, publishSuccessRate, queueDepthTotal
 *
 * No external dependencies — fully offline capable.
 */

export type MetricCounters = {
  uploadsTotal: number;
  processedTotal: number;
  publishedTotal: number;
  retriesTotal: number;
  failuresTotal: number;
  duplicateSkipsTotal: number;
  schedulerJobsTotal: number;
  queueWaiting: number;
  queueActive: number;
  queueCompleted: number;
  queueFailed: number;
};

export type MetricsSnapshot = MetricCounters & {
  /** ISO timestamp when the snapshot was taken. */
  collectedAt: string;
  /** Milliseconds for the most recent API response (Sprint 49). */
  apiResponseTimeMs: number;
  /** Approximate processed jobs per minute since process start (Sprint 49). */
  workerProcessedPerMinute: number;
  /** Publish success percentage 0–100 based on published vs failed counters (Sprint 49). */
  publishSuccessRate: number;
  /** Sum of waiting + active queue jobs (Sprint 49). */
  queueDepthTotal: number;
};

const ZERO_COUNTERS: MetricCounters = {
  uploadsTotal: 0,
  processedTotal: 0,
  publishedTotal: 0,
  retriesTotal: 0,
  failuresTotal: 0,
  duplicateSkipsTotal: 0,
  schedulerJobsTotal: 0,
  queueWaiting: 0,
  queueActive: 0,
  queueCompleted: 0,
  queueFailed: 0,
};

export class MetricsService {
  private counters: MetricCounters = { ...ZERO_COUNTERS };
  private apiResponseTimeMs = 0;
  private readonly startedAtMs: number;

  constructor(startedAt?: string | Date) {
    const parsed = startedAt ? new Date(startedAt).getTime() : Date.now();
    this.startedAtMs = Number.isNaN(parsed) ? Date.now() : parsed;
  }

  /** Increment a counter by `by` (default 1). */
  inc(key: keyof MetricCounters, by = 1): void {
    this.counters[key] += by;
  }

  /** Set a gauge to an exact value (intended for queue depth metrics). */
  set(key: keyof MetricCounters, value: number): void {
    this.counters[key] = value;
  }

  /** Record the latest API response duration in milliseconds. */
  recordResponseTime(ms: number): void {
    if (Number.isFinite(ms) && ms >= 0) {
      this.apiResponseTimeMs = Math.round(ms);
    }
  }

  /** Return a frozen copy of counters plus derived performance fields. */
  snapshot(): MetricsSnapshot {
    const uptimeMinutes = Math.max((Date.now() - this.startedAtMs) / 60_000, 1 / 60);
    const publishAttempts = this.counters.publishedTotal + this.counters.failuresTotal;
    const publishSuccessRate =
      publishAttempts > 0
        ? Math.round((this.counters.publishedTotal / publishAttempts) * 10_000) / 100
        : 100;

    return {
      ...this.counters,
      collectedAt: new Date().toISOString(),
      apiResponseTimeMs: this.apiResponseTimeMs,
      workerProcessedPerMinute:
        Math.round((this.counters.processedTotal / uptimeMinutes) * 100) / 100,
      publishSuccessRate,
      queueDepthTotal: this.counters.queueWaiting + this.counters.queueActive,
    };
  }

  /** Reset all counters to zero (useful between test cases). */
  reset(): void {
    this.counters = { ...ZERO_COUNTERS };
    this.apiResponseTimeMs = 0;
  }
}
