#!/usr/bin/env node
import { checkDatabaseHealth, connectDatabase, disconnectDatabase } from '../index.js';

async function main(): Promise<void> {
  await connectDatabase();

  const result = await checkDatabaseHealth();

  if (!result.ok) {
    console.error(`Database health check failed: ${result.error ?? 'unknown error'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Database health check passed (${result.latencyMs}ms)`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
