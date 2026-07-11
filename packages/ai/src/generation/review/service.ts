import type { InMemoryContentReviewStore } from './store.js';
import type { ContentReviewResult, SubmitContentReviewDecisionInput } from './types.js';

export interface ContentReviewService {
  submitDecision(input: SubmitContentReviewDecisionInput): ContentReviewResult;
}

/** Create a content review service backed by an in-memory store. */
export function createContentReviewService(
  store: InMemoryContentReviewStore,
): ContentReviewService {
  return Object.freeze({
    submitDecision(input: SubmitContentReviewDecisionInput): ContentReviewResult {
      return store.submitDecision(input);
    },
  });
}
