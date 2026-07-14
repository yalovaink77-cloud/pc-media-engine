import type {
  GenerationJobRequest,
  GenerationProviderAdapter,
  GenerationProviderCapabilities,
  GenerationProviderRequest,
  GenerationProviderResponse,
} from '@pcme/ai';

import type { PiercingConnectPilotConfig } from './config.js';

/** Wrap a generation provider with PiercingConnect pilot structure instructions. */
export class PilotStructuredGenerationProvider implements GenerationProviderAdapter {
  readonly providerId: string;
  readonly capabilities: GenerationProviderCapabilities;

  constructor(
    private readonly inner: GenerationProviderAdapter,
    private readonly structureInstruction: string,
    private readonly requiredSectionIds: readonly string[],
  ) {
    this.providerId = inner.providerId;
    this.capabilities = inner.capabilities;
  }

  generate(request: GenerationProviderRequest): Promise<GenerationProviderResponse> {
    return this.inner.generate({
      job: augmentJobWithPilotStructure(
        request.job,
        this.structureInstruction,
        this.requiredSectionIds,
      ),
    });
  }
}

export function createPilotStructuredGenerationProvider(
  inner: GenerationProviderAdapter,
  config: PiercingConnectPilotConfig,
): PilotStructuredGenerationProvider {
  return new PilotStructuredGenerationProvider(
    inner,
    config.structureInstruction,
    config.requiredSections.map((section) => section.id),
  );
}

function augmentJobWithPilotStructure(
  job: GenerationJobRequest,
  structureInstruction: string,
  requiredSectionIds: readonly string[],
): GenerationJobRequest {
  const promptPayload = job.promptPayload;
  return Object.freeze({
    ...job,
    promptPayload: Object.freeze({
      ...promptPayload,
      systemInstructions: Object.freeze([
        ...promptPayload.systemInstructions,
        Object.freeze({
          id: 'piercingconnect-pilot-structure',
          priority: 5,
          instruction: structureInstruction,
        }),
      ]),
      outputContract: Object.freeze({
        ...promptPayload.outputContract,
        sections: Object.freeze([
          ...new Set([...promptPayload.outputContract.sections, ...requiredSectionIds]),
        ]),
      }),
    }),
  });
}
