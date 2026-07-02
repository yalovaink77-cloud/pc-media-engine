export class ProjectScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectScopeError';
  }
}

/** Require a non-empty projectId for repository operations. */
export function requireProjectId(projectId: string | undefined | null): string {
  if (!projectId || projectId.trim().length === 0) {
    throw new ProjectScopeError('projectId is required for this operation');
  }

  return projectId;
}

/** Require a non-empty organizationId for repository operations. */
export function requireOrganizationId(organizationId: string | undefined | null): string {
  if (!organizationId || organizationId.trim().length === 0) {
    throw new ProjectScopeError('organizationId is required for this operation');
  }

  return organizationId;
}

/** Default filter excluding soft-deleted records. */
export function activeRecordsFilter() {
  return { deletedAt: null };
}
