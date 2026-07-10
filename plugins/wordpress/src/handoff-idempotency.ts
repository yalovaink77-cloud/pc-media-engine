import type { PublishingHandoffPublishResult } from '@pcme/publishing';

/** In-memory idempotency store for WordPress handoff publishes (tests/offline only). */
export class InMemoryWordPressHandoffIdempotencyStore {
  private readonly completed = new Map<string, PublishingHandoffPublishResult>();

  get(handoffId: string): PublishingHandoffPublishResult | undefined {
    const result = this.completed.get(handoffId);
    return result ? Object.freeze({ ...result }) : undefined;
  }

  has(handoffId: string): boolean {
    return this.completed.has(handoffId);
  }

  save(handoffId: string, result: PublishingHandoffPublishResult): void {
    this.completed.set(handoffId, Object.freeze({ ...result }));
  }
}
