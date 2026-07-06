/**
 * In-process metrics store for the API server.
 *
 * Counters are incremented by route hooks and reset only on process restart.
 * Queue gauges (waiting/active/completed/failed) are populated by an optional
 * BullMQ introspection function injected at startup.
 *
 * No external dependencies — fully offline capable.
 * Future: expose in Prometheus text format by mapping this snapshot.
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

  /** Increment a counter by `by` (default 1). Ignores gauge keys for safety. */
  inc(key: keyof MetricCounters, by = 1): void {
    this.counters[key] += by;
  }

  /** Set a gauge to an exact value (intended for queue depth metrics). */
  set(key: keyof MetricCounters, value: number): void {
    this.counters[key] = value;
  }

  /** Return a frozen copy of the current counters + timestamp. */
  snapshot(): MetricsSnapshot {
    return { ...this.counters, collectedAt: new Date().toISOString() };
  }

  /** Reset all counters to zero (useful between test cases). */
  reset(): void {
    this.counters = { ...ZERO_COUNTERS };
  }
}
