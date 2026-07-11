import type { FindingCategory, FindingCode } from './editorial-finding.js';

/** Stable identifier for an intelligence rule within a registry or profile scope. */
export type EditorialRuleId = string;

/** Machine-stable rule code (kebab-case). */
export type RuleCode = string;

/** Logical grouping key for related rules within an intelligence layer. */
export type RuleGroup = string;

/** Descriptive metadata attached to an intelligence rule. */
export interface EditorialRuleMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags?: readonly string[];
  readonly version?: string;
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/** Generic intelligence rule shared across all intelligence layers. */
export interface EditorialRule {
  readonly id: EditorialRuleId;
  readonly category: FindingCategory;
  readonly code: RuleCode;
  readonly analyzerId: string;
  readonly group: RuleGroup;
  readonly priority: number;
  readonly enabled: boolean;
  readonly metadata: EditorialRuleMetadata;
  readonly findingCode?: FindingCode;
}

/** Input shape for creating or normalizing a rule before ID assignment. */
export interface EditorialRuleInput {
  readonly id?: EditorialRuleId;
  readonly category: FindingCategory;
  readonly code: RuleCode;
  readonly analyzerId: string;
  readonly group: RuleGroup;
  readonly priority: number;
  readonly enabled?: boolean;
  readonly metadata: EditorialRuleMetadata;
  readonly findingCode?: FindingCode;
}

/** Pattern for stable kebab-case rule codes. */
export const RULE_CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Pattern for stable kebab-case rule group keys. */
export const RULE_GROUP_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** Pattern for deterministic 32-character rule identifiers. */
export const EDITORIAL_RULE_ID_PATTERN = /^[a-f0-9]{32}$/;
