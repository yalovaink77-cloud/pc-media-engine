import type { ContentGenerationPlan } from '@pcme/content';
import type { ContentRevisionRequest, GeneratedContentArtifact } from '@pcme/shared';

import type { GenerationJobRequest } from '../types.js';
import { buildDeterministicRevisionJobId } from './ids.js';

function serializeRevisionInstructions(revisionRequest: ContentRevisionRequest): string {
  const lines = [
    'Structured editorial revision request.',
    `Priority: ${revisionRequest.priority}.`,
    'Revise the prior draft to address the listed findings without inventing sources or URLs.',
    'Preserve provider whitespace exactly and do not perform dictionary repair.',
    'Human approval is still required after revision.',
  ];

  if (revisionRequest.humanNotes?.trim()) {
    lines.push(`Reviewer notes: ${revisionRequest.humanNotes.trim()}`);
  }

  for (const bundle of revisionRequest.moduleBundles) {
    lines.push(`Module: ${bundle.module}`);
    for (const item of bundle.items) {
      lines.push(
        [
          `- [${item.severity}] ${item.code}`,
          `Reason: ${item.reason}`,
          `Recommendation: ${item.recommendation.text}`,
          `Acceptance criteria: ${item.acceptanceCriteria.text}`,
        ].join('\n'),
      );
    }
  }

  return lines.join('\n\n');
}

export interface CreateRevisionGenerationJobInput {
  readonly plan: ContentGenerationPlan;
  readonly priorArtifact: GeneratedContentArtifact;
  readonly revisionRequest: ContentRevisionRequest;
  readonly jobIdGenerator?: typeof buildDeterministicRevisionJobId;
}

/** Create a provider-neutral revision generation job without rerunning the knowledge orchestrator. */
export function createRevisionGenerationJob(
  input: CreateRevisionGenerationJobInput,
): GenerationJobRequest {
  if (!input.plan.promptPayload) {
    throw new Error(
      'Revision generation requires the original frozen content generation plan payload',
    );
  }

  if (input.priorArtifact.snapshotId !== input.plan.snapshot.snapshotId) {
    throw new Error('Revision generation must reuse the original source snapshot');
  }

  const revisionInstructions = serializeRevisionInstructions(input.revisionRequest);
  const promptPayload = input.plan.promptPayload;

  const jobId = (input.jobIdGenerator ?? buildDeterministicRevisionJobId)({
    requestId: input.plan.requestId,
    sourceId: input.plan.sourceReference.sourceId,
    contentType: input.plan.contentType,
    revisionRequestId: input.revisionRequest.revisionRequestId,
  });

  return Object.freeze({
    jobId,
    requestId: input.plan.requestId,
    sourceId: input.plan.sourceReference.sourceId,
    snapshotId: input.plan.snapshot.snapshotId,
    contentType: input.plan.contentType,
    locale: input.plan.locale,
    tone: input.plan.tone,
    outputFormat: input.plan.outputFormat,
    promptPayload: Object.freeze({
      ...promptPayload,
      systemInstructions: Object.freeze([
        ...promptPayload.systemInstructions,
        Object.freeze({
          id: 'structured-revision-constraints',
          priority: 1,
          instruction: [
            'Do not invent sources, citations, or URLs.',
            'Preserve whitespace in the prior draft unless a finding requires a localized edit.',
            'Do not add promotional or conversion-oriented language.',
          ].join(' '),
        }),
      ]),
      userSections: Object.freeze([
        ...promptPayload.userSections,
        Object.freeze({
          id: 'prior-draft',
          title: 'Prior Draft',
          order: promptPayload.userSections.length + 1,
          content: input.priorArtifact.content,
        }),
        Object.freeze({
          id: 'structured-revision-request',
          title: 'Structured Revision Request',
          order: promptPayload.userSections.length + 2,
          content: revisionInstructions,
        }),
      ]),
      constraints: Object.freeze([
        ...promptPayload.constraints,
        Object.freeze({
          id: 'revision-do-not-invent-sources',
          category: 'evidence' as const,
          severity: 'required' as const,
          rule: 'Do not invent sources or URLs during revision.',
        }),
        Object.freeze({
          id: 'revision-preserve-whitespace',
          category: 'general' as const,
          severity: 'required' as const,
          rule: 'Preserve provider whitespace unless a finding requires a localized edit.',
        }),
      ]),
      outputContract: Object.freeze({
        ...promptPayload.outputContract,
      }),
      metadata: Object.freeze({ ...promptPayload.metadata }),
      warnings: Object.freeze([...promptPayload.warnings]),
    }),
    policySnapshot: input.priorArtifact.policySnapshot,
    metadata: Object.freeze({
      entityCount: input.plan.metadata.entityCount,
      promptSectionCount: input.plan.metadata.promptSectionCount + 2,
      constraintCount: input.plan.metadata.constraintCount + 2,
      estimatedInputCharacters:
        input.plan.metadata.estimatedInputCharacters +
        input.priorArtifact.content.length +
        revisionInstructions.length,
      providerNeutralPayloadSize:
        input.plan.metadata.estimatedInputCharacters +
        input.priorArtifact.content.length +
        revisionInstructions.length,
    }),
    createdAt: input.revisionRequest.createdAt,
    status: 'prepared',
  });
}
