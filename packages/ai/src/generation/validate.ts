import type { PromptPayloadResult } from '@pcme/content';

const BLOCKED_PATTERNS = [/template_path/, /sourcePath/, /\/(?:home|tmp|var|Users)\//];

export function containsBlockedJobMetadata(payload: PromptPayloadResult): boolean {
  const serialized = JSON.stringify(payload);

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(serialized)) {
      return true;
    }
  }

  if (serialized.includes('://')) {
    return true;
  }

  return payload.userSections.some((section) => {
    if (section.content.includes('template_path') || section.content.includes('sourcePath')) {
      return true;
    }
    return /\/(?:home|tmp|var|Users)\//.test(section.content);
  });
}

export function estimateProviderNeutralPayloadSize(payload: PromptPayloadResult): number {
  return JSON.stringify({
    systemInstructions: payload.systemInstructions,
    userSections: payload.userSections,
    constraints: payload.constraints,
    outputContract: payload.outputContract,
  }).length;
}
