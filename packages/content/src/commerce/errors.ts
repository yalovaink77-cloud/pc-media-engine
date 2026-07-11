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

/** Format loader errors for logs without exposing parser internals or raw documents. */
export function formatCommerceKnowledgeError(error: unknown): string {
  if (error instanceof CommerceKnowledgeError) {
    const parts = [error.message];
    if (error.filePath) {
      parts.push(`file=${error.filePath}`);
    }
    if (error.issues.length > 0) {
      parts.push(error.issues.join('; '));
    }
    return parts.join(' — ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
