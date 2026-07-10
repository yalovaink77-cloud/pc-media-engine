/** Configuration for explicit durable publishing worker execution. */
export type DurablePublishingWorkerConfig = {
  readonly databaseUrl: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly workerId: string;
  readonly leaseDurationMs: number;
  readonly defaultMaxAttempts: number;
  readonly registerWordPress: boolean;
};

const DEFAULT_WORKER_ID = 'pcme-durable-publishing-worker';
const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;

/** Load durable publishing worker configuration from environment variables. */
export function loadDurablePublishingWorkerConfig(
  env: Record<string, string | undefined> = process.env,
): DurablePublishingWorkerConfig | null {
  const databaseUrl = env['DATABASE_URL']?.trim();
  if (!databaseUrl) {
    return null;
  }

  const organizationId = env['PCME_DEFAULT_ORG_ID']?.trim();
  const projectId = env['PCME_DEFAULT_PROJECT_ID']?.trim();
  if (!organizationId || !projectId) {
    return null;
  }

  const workerId = env['PCME_DURABLE_PUBLISHING_WORKER_ID']?.trim() || DEFAULT_WORKER_ID;
  const leaseDurationMs = parseInt(
    env['PCME_DURABLE_PUBLISHING_LEASE_MS'] ?? `${DEFAULT_LEASE_MS}`,
    10,
  );
  const defaultMaxAttempts = parseInt(
    env['PCME_DURABLE_PUBLISHING_MAX_ATTEMPTS'] ?? `${DEFAULT_MAX_ATTEMPTS}`,
    10,
  );
  const registerWordPress = env['PCME_DURABLE_PUBLISHING_REGISTER_WORDPRESS'] === 'true';

  return Object.freeze({
    databaseUrl,
    organizationId,
    projectId,
    workerId,
    leaseDurationMs,
    defaultMaxAttempts,
    registerWordPress,
  });
}
