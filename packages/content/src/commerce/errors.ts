/** Error thrown when commerce knowledge files fail validation or cannot be read. */
export class CommerceKnowledgeError extends Error {
  readonly filePath?: string;
  readonly issues: string[];

  constructor(
    message: string,
    options?: { filePath?: string; issues?: string[]; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'CommerceKnowledgeError';
    this.filePath = options?.filePath;
    this.issues = options?.issues ?? [];
  }
}
