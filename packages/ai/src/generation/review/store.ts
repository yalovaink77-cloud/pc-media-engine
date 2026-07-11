import { randomUUID } from 'node:crypto';

import { createReviewCreatedHistoryEvent } from './create-request.js';
import { validateSubmitDecisionInput } from './decision-rules.js';
import { ContentReviewNotFoundError, ContentReviewTransitionError } from './errors.js';
import type {
  ContentReviewHistoryEvent,
  ContentReviewRequest,
  ContentReviewResult,
  SubmitContentReviewDecisionInput,
} from './types.js';

type ReviewRecord = {
  review: ContentReviewRequest;
  history: ContentReviewHistoryEvent[];
  findings: ContentReviewResult['findings'];
  latestDecision?: ContentReviewResult['latestDecision'];
  reviewer?: ContentReviewResult['reviewer'];
};

function cloneReviewRequest(review: ContentReviewRequest): ContentReviewRequest {
  return Object.freeze({
    ...review,
    warnings: Object.freeze(review.warnings.map((warning) => Object.freeze({ ...warning }))),
    requiredChecks: Object.freeze([...review.requiredChecks]),
    policySnapshot: Object.freeze({
      ...review.policySnapshot,
      safetyConstraints: Object.freeze([...review.policySnapshot.safetyConstraints]),
      affiliateConstraints: Object.freeze([...review.policySnapshot.affiliateConstraints]),
      citationRequirements: Object.freeze([...review.policySnapshot.citationRequirements]),
      blockedFields: Object.freeze([...review.policySnapshot.blockedFields]),
    }),
    preReviewFindings: review.preReviewFindings
      ? Object.freeze(
          review.preReviewFindings.map((finding) =>
            Object.freeze({
              ...finding,
              recommendation: Object.freeze({ ...finding.recommendation }),
              acceptanceCriteria: Object.freeze({ ...finding.acceptanceCriteria }),
              location: finding.location ? Object.freeze({ ...finding.location }) : undefined,
              metadata: finding.metadata ? Object.freeze({ ...finding.metadata }) : undefined,
            }),
          ),
        )
      : undefined,
    publicationReadiness: review.publicationReadiness
      ? Object.freeze({ ...review.publicationReadiness })
      : undefined,
  });
}

function cloneHistoryEvent(event: ContentReviewHistoryEvent): ContentReviewHistoryEvent {
  return Object.freeze({
    ...event,
    reviewer: event.reviewer ? Object.freeze({ ...event.reviewer }) : undefined,
    findings: event.findings
      ? Object.freeze(event.findings.map((finding) => Object.freeze({ ...finding })))
      : undefined,
  });
}

function toResult(record: ReviewRecord): ContentReviewResult {
  return Object.freeze({
    review: cloneReviewRequest(record.review),
    history: Object.freeze(record.history.map((event) => cloneHistoryEvent(event))),
    latestDecision: record.latestDecision,
    reviewer: record.reviewer ? Object.freeze({ ...record.reviewer }) : undefined,
    findings: Object.freeze(record.findings.map((finding) => Object.freeze({ ...finding }))),
  });
}

/** In-memory content review store for tests and offline development only. */
export class InMemoryContentReviewStore {
  private readonly records = new Map<string, ReviewRecord>();

  create(review: ContentReviewRequest): ContentReviewResult {
    if (this.records.has(review.reviewId)) {
      throw new Error(`Content review already exists: ${review.reviewId}`);
    }

    const record: ReviewRecord = {
      review: cloneReviewRequest(review),
      history: [createReviewCreatedHistoryEvent(review)],
      findings: Object.freeze([]),
    };

    this.records.set(review.reviewId, record);
    return toResult(record);
  }

  getById(reviewId: string): ContentReviewResult | undefined {
    const record = this.records.get(reviewId);
    return record ? toResult(record) : undefined;
  }

  listByArtifactId(artifactId: string): readonly ContentReviewResult[] {
    return Object.freeze(
      [...this.records.values()]
        .filter((record) => record.review.artifactId === artifactId)
        .map((record) => toResult(record)),
    );
  }

  submitDecision(input: SubmitContentReviewDecisionInput, nowMs?: number): ContentReviewResult {
    const record = this.requireRecord(input.reviewId);
    const nextStatus = validateSubmitDecisionInput(record.review, input, nowMs);
    const timestamp = new Date(nowMs ?? Date.now()).toISOString();
    const findings = Object.freeze(
      (input.findings ?? []).map((finding) => Object.freeze({ ...finding })),
    );

    const historyEvent = Object.freeze({
      eventId: randomUUID(),
      reviewId: input.reviewId,
      type: 'decision-submitted' as const,
      status: nextStatus,
      decision: input.decision,
      reviewer: Object.freeze({ ...input.reviewer }),
      notes: input.notes,
      findings,
      timestamp,
    });

    record.history.push(historyEvent);
    record.review = cloneReviewRequest({
      ...record.review,
      status: nextStatus,
    });
    record.latestDecision = input.decision;
    record.reviewer = Object.freeze({ ...input.reviewer });
    record.findings = findings;

    return toResult(record);
  }

  reopenAfterRevision(reviewId: string, timestamp?: string): ContentReviewResult {
    const record = this.requireRecord(reviewId);

    if (record.review.status !== 'changes-requested') {
      throw new ContentReviewTransitionError(reviewId, record.review.status, 'pending-review');
    }

    const eventTimestamp = timestamp ?? new Date().toISOString();
    const historyEvent = Object.freeze({
      eventId: randomUUID(),
      reviewId,
      type: 'reopened' as const,
      status: 'pending-review' as const,
      timestamp: eventTimestamp,
    });

    record.history.push(historyEvent);
    record.review = cloneReviewRequest({
      ...record.review,
      status: 'pending-review',
    });
    record.latestDecision = undefined;

    return toResult(record);
  }

  private requireRecord(reviewId: string): ReviewRecord {
    const record = this.records.get(reviewId);
    if (!record) {
      throw new ContentReviewNotFoundError(reviewId);
    }
    return record;
  }
}
