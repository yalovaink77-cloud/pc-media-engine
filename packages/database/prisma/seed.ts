import { PrismaClient } from '@prisma/client';

const DEFAULT_ORG_SLUG = 'default-operator';
const DEFAULT_ORG_NAME = 'Default Operator';
const DEFAULT_PROJECT_SLUG = 'piercingconnect';
const DEFAULT_PROJECT_NAME = 'PiercingConnect';
const DEFAULT_PROJECT_DOMAIN = 'piercingconnect.com';

const piercingConnectSettings = {
  voiceProfile:
    'Clinical but approachable. Safety-first. Explain risks without fear-mongering. Never provide medical diagnosis. Encourage professional piercer consultation.',
  enabledContentTypes: [
    'guide',
    'faq',
    'aftercare_card',
    'printable',
    'affiliate_section',
    'bmc_block',
  ],
  aiConfig: {
    provider: 'claude',
    defaultModel: 'claude-sonnet-4-20250514',
  },
  storageConfig: {
    provider: 'local',
    root: './data/media/piercingconnect',
  },
  publishingConfig: {
    wordpress: {
      siteUrl: 'https://piercingconnect.com',
      seoPlugin: 'yoast',
    },
  },
  monetizationConfig: {
    buyMeACoffee: { username: 'TBD' },
    amazonAffiliate: { tag: 'TBD', region: 'us' },
  },
  seoDefaults: {
    titleSuffix: '| PiercingConnect',
  },
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const organization = await prisma.organization.upsert({
      where: { slug: DEFAULT_ORG_SLUG },
      update: { name: DEFAULT_ORG_NAME },
      create: {
        slug: DEFAULT_ORG_SLUG,
        name: DEFAULT_ORG_NAME,
      },
    });

    const project = await prisma.project.upsert({
      where: {
        organizationId_slug: {
          organizationId: organization.id,
          slug: DEFAULT_PROJECT_SLUG,
        },
      },
      update: {
        name: DEFAULT_PROJECT_NAME,
        domain: DEFAULT_PROJECT_DOMAIN,
        settings: piercingConnectSettings,
      },
      create: {
        organizationId: organization.id,
        slug: DEFAULT_PROJECT_SLUG,
        name: DEFAULT_PROJECT_NAME,
        domain: DEFAULT_PROJECT_DOMAIN,
        settings: piercingConnectSettings,
      },
    });

    console.log(`Seeded organization: ${organization.slug} (${organization.id})`);
    console.log(`Seeded project: ${project.slug} (${project.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
