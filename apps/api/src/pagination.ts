/**
 * Shared pagination helpers — Sprint 49.
 *
 * Consistent clamping for list endpoints. Invalid or missing values fall back
 * to defaults; limits are always capped at the route maximum.
 */

/** Parse and clamp a page size query parameter. */
export function clampLimit(
  raw: string | undefined,
  defaultLimit: number,
  maxLimit: number,
): number {
  if (!raw) return defaultLimit;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return defaultLimit;
  return Math.min(n, maxLimit);
}

/** Parse and clamp a zero-based offset query parameter. */
export function clampOffset(raw: string | undefined, maxOffset = Number.MAX_SAFE_INTEGER): number {
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, maxOffset);
}

/** Strict limit parser used by dashboard routes — returns error message when invalid. */
export function parseStrictLimit(
  raw: unknown,
  max: number,
  def: number,
): { value: number; error?: string } {
  if (raw === undefined || raw === null) return { value: def };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { value: 0, error: 'limit must be a positive integer' };
  if (n > max) return { value: 0, error: `limit must not exceed ${max}` };
  return { value: n };
}
