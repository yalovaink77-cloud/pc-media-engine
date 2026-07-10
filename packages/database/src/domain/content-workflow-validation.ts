import type {
  ContentReviewDecision,
  ContentReviewStatus,
  GeneratedContentStatus,
} from '@pcme/shared';

const APPROVABLE_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
]);
const REJECTABLE_STATUSES = new Set<GeneratedContentStatus>([
  'generated',
  'generated-with-warnings',
  'invalid',
]);

export function assertArtifactStatusTransition(
  artifactId: string,
  fromStatus: GeneratedContentStatus,
  toStatus: GeneratedContentStatus,
): void {
  if (fromStatus === toStatus) {
    return;
  }

  if (toStatus === 'approved' && APPROVABLE_STATUSES.has(fromStatus)) {
    return;
  }

  if (toStatus === 'rejected' && REJECTABLE_STATUSES.has(fromStatus)) {
    return;
  }

  throw new Error(
    `Cannot transition generated content artifact ${artifactId} from ${fromStatus} to ${toStatus}`,
  );
}

export function toDbGeneratedContentArtifactStatus(
  status: GeneratedContentStatus,
): GeneratedContentArtifactStatusDb {
  switch (status) {
    case 'generated':
      return 'generated';
    case 'generated-with-warnings':
      return 'generated_with_warnings';
    case 'invalid':
      return 'invalid';
    case 'rejected':
      return 'rejected';
    case 'approved':
      return 'approved';
  }
}

export function fromDbGeneratedContentArtifactStatus(
  status: GeneratedContentArtifactStatusDb,
): GeneratedContentStatus {
  switch (status) {
    case 'generated':
      return 'generated';
    case 'generated_with_warnings':
      return 'generated-with-warnings';
    case 'invalid':
      return 'invalid';
    case 'rejected':
      return 'rejected';
    case 'approved':
      return 'approved';
  }
}

export function toDbContentReviewStatus(status: ContentReviewStatus): ContentReviewStatusDb {
  switch (status) {
    case 'pending-review':
      return 'pending_review';
    case 'approved':
      return 'approved';
    case 'approved-with-notes':
      return 'approved_with_notes';
    case 'changes-requested':
      return 'changes_requested';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'expired';
  }
}

export function fromDbContentReviewStatus(status: ContentReviewStatusDb): ContentReviewStatus {
  switch (status) {
    case 'pending_review':
      return 'pending-review';
    case 'approved':
      return 'approved';
    case 'approved_with_notes':
      return 'approved-with-notes';
    case 'changes_requested':
      return 'changes-requested';
    case 'rejected':
      return 'rejected';
    case 'expired':
      return 'expired';
  }
}

export function toDbContentReviewEventType(
  type: 'created' | 'decision-submitted' | 'reopened',
): ContentReviewEventTypeDb {
  switch (type) {
    case 'created':
      return 'created';
    case 'decision-submitted':
      return 'decision_submitted';
    case 'reopened':
      return 'reopened';
  }
}

export function fromDbContentReviewEventType(
  type: ContentReviewEventTypeDb,
): 'created' | 'decision-submitted' | 'reopened' {
  switch (type) {
    case 'created':
      return 'created';
    case 'decision_submitted':
      return 'decision-submitted';
    case 'reopened':
      return 'reopened';
  }
}

export function toDbContentReviewDecision(
  decision: ContentReviewDecision,
): ContentReviewDecisionDb {
  switch (decision) {
    case 'approve':
      return 'approve';
    case 'approve-with-notes':
      return 'approve_with_notes';
    case 'request-changes':
      return 'request_changes';
    case 'reject':
      return 'reject';
  }
}

export function fromDbContentReviewDecision(
  decision: ContentReviewDecisionDb,
): ContentReviewDecision {
  switch (decision) {
    case 'approve':
      return 'approve';
    case 'approve_with_notes':
      return 'approve-with-notes';
    case 'request_changes':
      return 'request-changes';
    case 'reject':
      return 'reject';
  }
}

export type GeneratedContentArtifactStatusDb =
  'generated' | 'generated_with_warnings' | 'invalid' | 'rejected' | 'approved';

export type ContentReviewStatusDb =
  | 'pending_review'
  | 'approved'
  | 'approved_with_notes'
  | 'changes_requested'
  | 'rejected'
  | 'expired';

export type ContentReviewEventTypeDb = 'created' | 'decision_submitted' | 'reopened';

export type ContentReviewDecisionDb =
  'approve' | 'approve_with_notes' | 'request_changes' | 'reject';

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/,
  /Bearer\s+[a-zA-Z0-9._-]+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
];

const BLOCKED_METADATA_PATTERNS = [
  /template_path/i,
  /sourcePath/i,
  /source_path/i,
  /repoPath/i,
  /__proto__/,
  /^---\s*\n/m,
];

const ABSOLUTE_PATH_PATTERNS = [
  /\/(?:home|tmp|var|Users|etc|root)\/[^\s"'<>]*/,
  /^[A-Za-z]:[\\/][^\s"'<>]*/,
  /[a-z]+:\/\/[^\s"'<>]+/i,
];

function matchesAnyPattern(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export class ContentWorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentWorkflowValidationError';
  }
}

/** Reject blocked metadata before persisting workflow records. */
export function assertPersistableText(value: string, field: string): void {
  if (
    matchesAnyPattern(value, SECRET_PATTERNS) ||
    matchesAnyPattern(value, ABSOLUTE_PATH_PATTERNS) ||
    matchesAnyPattern(value, BLOCKED_METADATA_PATTERNS)
  ) {
    throw new ContentWorkflowValidationError(`Blocked metadata detected in ${field}`);
  }
}

export function assertPersistableArtifactContent(content: string): void {
  assertPersistableText(content, 'artifact.content');
}

export function assertPersistableJsonValue(value: unknown, path = 'value'): void {
  if (typeof value === 'string') {
    assertPersistableText(value, path);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPersistableJsonValue(entry, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      assertPersistableJsonValue(entry, `${path}.${key}`);
    }
  }
}
