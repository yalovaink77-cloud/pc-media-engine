import { PrismaClient } from '@prisma/client';

import { loadDatabaseEnv } from './config.js';

let prisma: PrismaClient | undefined;

export type PrismaClientInstance = PrismaClient;

/** Return a singleton Prisma client. Validates DATABASE_URL on first access. */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    loadDatabaseEnv();
    prisma = new PrismaClient();
  }

  return prisma;
}

/** Establish the database connection pool. */
export async function connectDatabase(client: PrismaClient = getPrismaClient()): Promise<void> {
  loadDatabaseEnv();
  await client.$connect();
}

/** Disconnect and reset the singleton client. */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

/** Replace the singleton — intended for tests only. */
export function setPrismaClientForTests(client: PrismaClient | undefined): void {
  prisma = client;
}

/** Create a dedicated client without touching the singleton (for scripts). */
export function createPrismaClient(): PrismaClient {
  loadDatabaseEnv();
  return new PrismaClient();
}
