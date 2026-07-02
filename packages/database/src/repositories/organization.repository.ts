import type { Organization, Prisma, PrismaClient, Project } from '@prisma/client';

import { getPrismaClient } from '../client.js';
import { requireOrganizationId } from './scoped-query.js';

export class OrganizationRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  findBySlug(slug: string): Promise<Organization | null> {
    return this.client.organization.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Organization | null> {
    return this.client.organization.findUnique({ where: { id } });
  }

  create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.client.organization.create({ data });
  }
}

export class ProjectRepository {
  constructor(private readonly client: PrismaClient = getPrismaClient()) {}

  findByOrganizationAndSlug(organizationId: string, slug: string): Promise<Project | null> {
    return this.client.project.findUnique({
      where: {
        organizationId_slug: {
          organizationId: requireOrganizationId(organizationId),
          slug,
        },
      },
    });
  }

  findById(projectId: string): Promise<Project | null> {
    return this.client.project.findUnique({ where: { id: projectId } });
  }

  listByOrganization(organizationId: string): Promise<Project[]> {
    return this.client.project.findMany({
      where: { organizationId: requireOrganizationId(organizationId) },
      orderBy: { name: 'asc' },
    });
  }

  create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.client.project.create({ data });
  }
}
