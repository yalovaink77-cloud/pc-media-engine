export { EditorialAnalyzer, type EditorialAnalyzerOptions } from './analyzer.js';
export { dedupeAndSortEditorialFindings } from './dedupe.js';
export {
  countWords,
  detectMalformedMarkdownHeadings,
  escapeRegExp,
  extractMarkdownHeadings,
  extractMarkdownSections,
  type MarkdownHeading,
  type MarkdownSection,
  normalizeHeadingText,
  splitParagraphs,
  splitSentences,
  stripProtectedMarkdownRegions,
} from './markdown.js';
export { createEditorialAnalyzerModule, type EditorialAnalyzerModuleOptions } from './module.js';
export {
  createDefaultEditorialRuleRegistry,
  DEFAULT_RULE_DEFINITIONS,
  EDITORIAL_RULE_CODES,
} from './rule-registry.js';
export {
  createEditorialRuleExecutionContext,
  EDITORIAL_RULE_EXECUTORS,
  type EditorialRuleCode,
  type EditorialRuleExecutionContext,
  type EditorialRuleExecutor,
} from './rules.js';
export type { EditorialAnalysisInput, EditorialAnalysisResult } from './types.js';
