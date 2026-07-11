import type { GenerationPolicySnapshot } from '../types.js';
import type { GeneratedContentWarning } from './types.js';

const DIAGNOSIS_PATTERNS = [
  /\byou have (?:a |an )?(?:infection|allergic reaction|keloid|rejection)\b/i,
  /\bthis is (?:definitely|certainly) (?:an infection|a keloid|a rejection)\b/i,
  /\byou are diagnosed with\b/i,
  /\bmedical diagnosis:\b/i,
];

const AGGRESSIVE_AFFILIATE_PATTERNS = [
  /\bbuy now\b/i,
  /\blimited time offer\b/i,
  /\bclick here to buy\b/i,
  /\bbest deal\b/i,
  /\bact now\b/i,
  /\bdon't miss out\b/i,
  /\b#1 (?:product|choice|pick)\b/i,
];

const UNCERTAINTY_PATTERNS = [
  /\bmay vary\b/i,
  /\bconsult (?:a |your )(?:professional|doctor|piercer|healthcare)\b/i,
  /\bnot (?:a substitute for|medical advice)\b/i,
  /\bif (?:unsure|uncertain|in doubt)\b/i,
  /\bindividual results\b/i,
  /\bmay differ\b/i,
];

const CITATION_PLACEHOLDER_PATTERNS = [
  /\[(?:citation|source|ref)(?::[^\]]+)?\]/i,
  /\{\{(?:citation|source|ref)(?::[^}]+)?\}\}/i,
  /\[\[source:[^\]]+\]\]/i,
];

function buildWarning(
  code: string,
  message: string,
  severity: GeneratedContentWarning['severity'],
): GeneratedContentWarning {
  return Object.freeze({ code, message, severity });
}

/** Run lightweight safety heuristics and return warnings only. */
export function detectGeneratedContentSafetyWarnings(
  content: string,
  policySnapshot: GenerationPolicySnapshot,
): readonly GeneratedContentWarning[] {
  const warnings: GeneratedContentWarning[] = [];

  if (policySnapshot.safetyConstraints.includes('no-diagnosis')) {
    for (const pattern of DIAGNOSIS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(
          buildWarning(
            'possible-diagnosis-claim',
            'Content may contain prohibited diagnosis-style language',
            'warning',
          ),
        );
        break;
      }
    }
  }

  if (policySnapshot.affiliateConstraints.length > 0) {
    for (const pattern of AGGRESSIVE_AFFILIATE_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(
          buildWarning(
            'aggressive-affiliate-language',
            'Content may contain aggressive affiliate call-to-action language',
            'warning',
          ),
        );
        break;
      }
    }
  }

  const requiresUncertainty =
    policySnapshot.safetyConstraints.includes('uncertainty-disclosure') ||
    !policySnapshot.contextComplete;

  if (requiresUncertainty) {
    const hasUncertainty = UNCERTAINTY_PATTERNS.some((pattern) => pattern.test(content));
    if (!hasUncertainty) {
      warnings.push(
        buildWarning(
          'missing-uncertainty-language',
          'Content may lack required uncertainty or professional-consultation language',
          'warning',
        ),
      );
    }
  }

  if (policySnapshot.citationRequirements.includes('citation-placeholders')) {
    const hasCitationPlaceholder = CITATION_PLACEHOLDER_PATTERNS.some((pattern) =>
      pattern.test(content),
    );
    if (!hasCitationPlaceholder) {
      warnings.push(
        buildWarning(
          'missing-citation-placeholders',
          'Content may lack required citation placeholders',
          'warning',
        ),
      );
    }
  }

  return Object.freeze(warnings);
}
