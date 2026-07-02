import { z } from 'zod';

const postgresUrlSchema = z
  .string()
  .min(1, 'DATABASE_URL is required')
  .refine(
    (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'DATABASE_URL must be a PostgreSQL connection string',
  );

export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresUrlSchema,
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export class DatabaseEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseEnvError';
  }
}

/** Load and validate required database environment variables. Fails fast if invalid. */
export function loadDatabaseEnv(
  env: Record<string, string | undefined> = process.env,
): DatabaseEnv {
  const parsed = databaseEnvSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new DatabaseEnvError(`Invalid database environment: ${details}`);
  }

  return parsed.data;
}
