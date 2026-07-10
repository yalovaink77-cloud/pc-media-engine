/** Deterministic exponential backoff for publishing outbox retries. */
export function computePublishingRetryAvailableAt(input: {
  readonly attemptCount: number;
  readonly baseDelayMs?: number;
  readonly now?: Date;
}): Date {
  const baseDelayMs = input.baseDelayMs ?? 5_000;
  const attemptCount = Math.max(1, input.attemptCount);
  const delayMs = baseDelayMs * 2 ** (attemptCount - 1);
  const now = input.now ?? new Date();
  return new Date(now.getTime() + delayMs);
}
