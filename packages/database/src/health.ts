import type { PrismaClient } from '@prisma/client';

import { getPrismaClient } from './client.js';

export interface DatabaseHealthResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

/** Run a lightweight connectivity check (`SELECT 1`). */
export async function checkDatabaseHealth(
  client: PrismaClient = getPrismaClient(),
): Promise<DatabaseHealthResult> {
  const startedAt = Date.now();

  try {
    await client.$queryRaw`SELECT 1`;
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
