import type { KnowledgeContextResult } from '../knowledge/context/types.js';
import type { EntityType } from '../knowledge/types.js';

/** Supported output formats for generated content (provider-neutral). */
export type PromptOutputFormat = 'markdown' | 'plain-text' | (string & {});

/** Binding that maps a user section to context entities or static text. */
export interface PromptContentSectionBinding {
  readonly entityTypes?: readonly EntityType[];
  readonly includeRoot?: boolean;
  readonly staticText?: string;
}

/** Declarative content recipe for prompt payload assembly. */
export interface PromptContentRecipeDefinition {
  readonly id: string;
  readonly requiredContextRecipeId: string;
  readonly contentObjective: string;
  readonly sectionOrder: readonly string[];
  readonly sectionBindings: Readonly<Partial<Record<string, PromptContentSectionBinding>>>;
  readonly mandatorySafetyConstraintIds: readonly string[];
  readonly optionalAffiliateSections?: readonly string[];
  readonly outputStructure: readonly string[];
  readonly allowedCtaTypes: readonly string[];
  readonly prohibitedCtaTypes: readonly string[];
}

/** Request to build a provider-neutral prompt payload from knowledge context. */
export interface PromptPayloadRequest {
  readonly context: KnowledgeContextResult;
  readonly contentType: string;
  readonly locale?: string;
  readonly tone?: string;
  readonly outputFormat?: PromptOutputFormat;
  readonly strict?: boolean;
}

/** Ordered system-level instruction for AI generation. */
export interface PromptSystemInstruction {
  readonly id: string;
  readonly priority: number;
  readonly instruction: string;
}

/** Structured user-facing prompt section with serialized context. */
export interface PromptUserSection {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly content: string;
}

/** Safety or policy constraint enforced in the payload. */
export interface PromptConstraint {
  readonly id: string;
  readonly category: 'evidence' | 'affiliate' | 'medical' | 'disclosure' | 'general';
  readonly rule: string;
  readonly severity: 'required' | 'recommended';
}

/** Output contract describing expected generation shape. */
export interface PromptOutputContract {
  readonly format: PromptOutputFormat;
  readonly locale: string;
  readonly tone: string;
  readonly sections: readonly string[];
  readonly allowedCtaTypes: readonly string[];
  readonly prohibitedCtaTypes: readonly string[];
}

/** Warning emitted during prompt payload assembly. */
export interface PromptPayloadWarning {
  readonly code:
    | 'missing-required-context'
    | 'context-truncated'
    | 'context-incomplete'
    | 'wrong-context-recipe'
    | 'affiliate-section-suppressed';
  readonly message: string;
}

/** Token-budget preparation metadata (no tokenizer integration). */
export interface PromptPayloadBudgetMetadata {
  readonly estimatedInputCharacters: number;
  readonly estimatedSectionCount: number;
  readonly entityCount: number;
  readonly truncationWarning: boolean;
}

/** Provider-neutral metadata attached to a prompt payload. */
export interface PromptPayloadMetadata extends PromptPayloadBudgetMetadata {
  readonly contentType: string;
  readonly contextRecipeId: string;
  readonly locale: string;
  readonly tone: string;
  readonly outputFormat: PromptOutputFormat;
  readonly rootEntityType: EntityType;
  readonly rootEntityId: string;
  readonly snapshotId: string;
}

/** Complete provider-neutral prompt payload ready for AI orchestration. */
export interface PromptPayloadResult {
  readonly contentType: string;
  readonly systemInstructions: readonly PromptSystemInstruction[];
  readonly userSections: readonly PromptUserSection[];
  readonly constraints: readonly PromptConstraint[];
  readonly outputContract: PromptOutputContract;
  readonly metadata: PromptPayloadMetadata;
  readonly warnings: readonly PromptPayloadWarning[];
}

/** Registry contract for content-type prompt recipes. */
export interface PromptContentRecipeRegistry {
  getContentRecipes(): readonly PromptContentRecipeDefinition[];
}
