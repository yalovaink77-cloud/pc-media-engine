import type { GenerationJobRequest } from '@pcme/ai';

export interface OpenRouterChatMessage {
  readonly role: 'system' | 'user';
  readonly content: string;
}

export interface OpenRouterChatCompletionRequestBody {
  readonly model: string;
  readonly messages: readonly OpenRouterChatMessage[];
  readonly max_tokens: number;
  readonly temperature: number;
}

function formatConstraints(job: GenerationJobRequest): string {
  if (job.promptPayload.constraints.length === 0) {
    return '';
  }

  const lines = job.promptPayload.constraints.map(
    (constraint) => `[${constraint.id}] ${constraint.rule}`,
  );
  return ['Policy constraints:', ...lines].join('\n');
}

function formatOutputContract(job: GenerationJobRequest): string {
  const contract = job.promptPayload.outputContract;
  const lines = [
    `Output format: ${contract.format}`,
    `Locale: ${contract.locale}`,
    `Tone: ${contract.tone}`,
    `Sections: ${contract.sections.join(', ')}`,
  ];

  if (contract.allowedCtaTypes.length > 0) {
    lines.push(`Allowed CTA types: ${contract.allowedCtaTypes.join(', ')}`);
  }
  if (contract.prohibitedCtaTypes.length > 0) {
    lines.push(`Prohibited CTA types: ${contract.prohibitedCtaTypes.join(', ')}`);
  }

  return ['Output contract:', ...lines].join('\n');
}

/** Build provider-neutral chat messages from a generation job request. */
export function buildChatMessagesFromJob(
  job: GenerationJobRequest,
): readonly OpenRouterChatMessage[] {
  const systemParts = [
    ...job.promptPayload.systemInstructions
      .slice()
      .sort((left, right) => left.priority - right.priority)
      .map((instruction) => instruction.instruction),
    formatConstraints(job),
    formatOutputContract(job),
  ].filter((part) => part.length > 0);

  const userParts = job.promptPayload.userSections
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((section) => `## ${section.title}\n${section.content}`);

  return Object.freeze([
    Object.freeze({ role: 'system', content: systemParts.join('\n\n') }),
    Object.freeze({ role: 'user', content: userParts.join('\n\n') }),
  ]);
}

/** Build a deterministic OpenRouter chat completion request body. */
export function buildChatCompletionRequestBody(
  job: GenerationJobRequest,
  options: {
    model: string;
    maxOutputTokens: number;
    temperature: number;
  },
): OpenRouterChatCompletionRequestBody {
  return Object.freeze({
    model: options.model,
    messages: buildChatMessagesFromJob(job),
    max_tokens: options.maxOutputTokens,
    temperature: options.temperature,
  });
}
