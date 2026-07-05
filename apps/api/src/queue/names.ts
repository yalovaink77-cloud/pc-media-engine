export const PROCESSING_QUEUE = 'processing' as const;

export type ProcessingJobPayload = {
  processingJobId: string;
};
