/**
 * Ghost Admin API error types — Sprint 35.
 */

import type { ErrorCategory } from '@pcme/publisher-sdk';

export type GhostErrorCategory = ErrorCategory;

export class GhostApiError extends Error {
  public readonly category: GhostErrorCategory;

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    category?: GhostErrorCategory,
  ) {
    super(message);
    this.name = 'GhostApiError';
    this.category = category ?? categorizeHttpStatus(status);
  }
}

export function categorizeHttpStatus(status: number): GhostErrorCategory {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'validation';
  if (status >= 500 && status < 600) return 'server_error';
  return 'unknown';
}

export function categorizeGhostErrorType(type: string): GhostErrorCategory | null {
  const t = type.toLowerCase();
  if (t.includes('unauthorized') || t.includes('permission')) return 'auth';
  if (t.includes('validation') || t.includes('invalid')) return 'validation';
  if (t.includes('notfound')) return 'not_found';
  return null;
}

type GhostErrorBody = {
  errors?: Array<{
    message?: string;
    type?: string;
    context?: string;
    code?: string;
  }>;
};

export async function parseGhostErrorResponse(response: Response): Promise<GhostApiError> {
  let code = 'unknown';
  let message = `Ghost returned HTTP ${response.status}`;
  let category: GhostErrorCategory = categorizeHttpStatus(response.status);

  try {
    const body = (await response.json()) as GhostErrorBody;
    const first = body.errors?.[0];
    if (first?.type) {
      code = first.type;
      const typeCat = categorizeGhostErrorType(first.type);
      if (typeCat) category = typeCat;
    }
    if (first?.message) message = first.message;
    else if (first?.context) message = first.context;
  } catch {
    // unparseable body
  }

  return new GhostApiError(response.status, code, message, category);
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof GhostApiError) {
    return (
      err.category === 'rate_limit' || err.category === 'server_error' || err.category === 'network'
    );
  }
  if (err instanceof TypeError) return true;
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return true;
  }
  return false;
}
