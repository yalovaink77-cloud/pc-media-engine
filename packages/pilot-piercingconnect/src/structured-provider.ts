import type {
  GenerationJobRequest,
  GenerationProviderAdapter,
  GenerationProviderCapabilities,
  GenerationProviderRequest,
  GenerationProviderResponse,
} from '@pcme/ai';

/** Wrap a generation provider with PiercingConnect pilot structure instructions. */
export class PilotStructuredGenerationProvider implements GenerationProviderAdapter {
  readonly providerId: string;
  readonly capabilities: GenerationProviderCapabilities;

  constructor(
    private readonly inner: GenerationProviderAdapter,
    private readonly structureInstruction: string,
  ) {
    this.providerId = inner.providerId;
    this.capabilities = inner.capabilities;
  }

  generate(request: GenerationProviderRequest): Promise<GenerationProviderResponse> {
    return this.inner.generate({
      job: augmentJobWithPilotStructure(request.job, this.structureInstruction),
    });
  }
}

function augmentJobWithPilotStructure(
  job: GenerationJobRequest,
  structureInstruction: string,
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
          ...new Set([
            ...promptPayload.outputContract.sections,
            'title',
            'introduction',
            'product-overview',
            'ingredients',
            'safety-and-suitability',
            'benefits',
            'limitations',
            'who-it-may-suit',
            'alternatives',
            'faq',
            'disclosure',
            'source-notes',
          ]),
        ]),
      }),
    }),
  });
}
