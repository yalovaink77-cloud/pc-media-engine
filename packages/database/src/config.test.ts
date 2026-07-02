import { describe, expect, it } from 'vitest';

import { DatabaseEnvError, loadDatabaseEnv } from './config.js';

describe('loadDatabaseEnv', () => {
  it('accepts a valid PostgreSQL connection string', () => {
    const env = loadDatabaseEnv({
      DATABASE_URL: 'postgresql://pcme:pcme_dev@localhost:5432/pcme_dev',
    });

    expect(env.DATABASE_URL).toContain('postgresql://');
  });

  it('accepts postgres:// protocol alias', () => {
    const env = loadDatabaseEnv({
      DATABASE_URL: 'postgres://pcme:pcme_dev@localhost:5432/pcme_dev',
    });

    expect(env.DATABASE_URL).toContain('postgres://');
  });

  it('fails fast when DATABASE_URL is missing', () => {
    expect(() => loadDatabaseEnv({})).toThrow(DatabaseEnvError);
  });

  it('fails fast when DATABASE_URL is not PostgreSQL', () => {
    expect(() =>
      loadDatabaseEnv({
        DATABASE_URL: 'mysql://user:pass@localhost:3306/db',
      }),
    ).toThrow(DatabaseEnvError);
  });
});

describe('requireProjectId', () => {
  it('rejects empty projectId values', async () => {
    const { requireProjectId, ProjectScopeError } = await import('./repositories/scoped-query.js');

    expect(() => requireProjectId('')).toThrow(ProjectScopeError);
    expect(() => requireProjectId('   ')).toThrow(ProjectScopeError);
  });
});
