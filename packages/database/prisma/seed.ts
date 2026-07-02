import { PrismaClient } from '@prisma/client';

const DEFAULT_ORG_SLUG = 'default-operator';
const DEFAULT_ORG_NAME = 'Default Operator';
const DEFAULT_PROJECT_SLUG = 'piercingconnect';
const DEFAULT_PROJECT_NAME = 'PiercingConnect';
const DEFAULT_PROJECT_DOMAIN = 'piercingconnect.com';

const SAMPLE_ASSET_ID = 'seedpc0001';
const SAMPLE_INGESTION_SOURCE_ID = 'seedpcingest001';
const SAMPLE_INGESTION_JOB_ID = 'seedpcingestjob001';
const SAMPLE_CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

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

    const storageKey = `${DEFAULT_PROJECT_SLUG}/${SAMPLE_ASSET_ID}/navel-aftercare-guide-cover.jpg`;

    const asset = await prisma.asset.upsert({
      where: {
        projectId_storageKey: {
          projectId: project.id,
          storageKey,
        },
      },
      update: {
        altText: 'Navel piercing aftercare guide cover image',
        tags: ['cover', 'aftercare', 'seed'],
      },
      create: {
        id: SAMPLE_ASSET_ID,
        organizationId: organization.id,
        projectId: project.id,
        filename: 'navel-aftercare-guide-cover.jpg',
        originalFilename: 'Navel Aftercare Guide Cover.jpg',
        mimeType: 'image/jpeg',
        storageProvider: 'local',
        storageKey,
        sizeBytes: 0,
        checksum: SAMPLE_CHECKSUM,
        checksumAlgorithm: 'sha256',
        altText: 'Navel piercing aftercare guide cover image',
        tags: ['cover', 'aftercare', 'seed'],
        status: 'ready',
      },
    });

    await prisma.mediaSource.upsert({
      where: { id: `${SAMPLE_ASSET_ID}_source` },
      update: {
        sourceLabel: 'Seed placeholder — metadata only',
      },
      create: {
        id: `${SAMPLE_ASSET_ID}_source`,
        organizationId: organization.id,
        projectId: project.id,
        assetId: asset.id,
        sourceType: 'unknown',
        sourceLabel: 'Seed placeholder — metadata only',
      },
    });

    await prisma.metadataRecord.upsert({
      where: {
        assetId_namespace_key: {
          assetId: asset.id,
          namespace: 'dimensions',
          key: 'width_px',
        },
      },
      update: {
        value: 1200,
      },
      create: {
        organizationId: organization.id,
        projectId: project.id,
        assetId: asset.id,
        namespace: 'dimensions',
        key: 'width_px',
        value: 1200,
      },
    });

    await prisma.metadataRecord.upsert({
      where: {
        assetId_namespace_key: {
          assetId: asset.id,
          namespace: 'dimensions',
          key: 'height_px',
        },
      },
      update: {
        value: 630,
      },
      create: {
        organizationId: organization.id,
        projectId: project.id,
        assetId: asset.id,
        namespace: 'dimensions',
        key: 'height_px',
        value: 630,
      },
    });

    const ingestionSource = await prisma.ingestionSource.upsert({
      where: {
        projectId_sourceType_sourceUri: {
          projectId: project.id,
          sourceType: 'local_folder',
          sourceUri: './data/media/piercingconnect/inbox',
        },
      },
      update: {
        sourceLabel: 'PiercingConnect local inbox (seed placeholder)',
      },
      create: {
        id: SAMPLE_INGESTION_SOURCE_ID,
        organizationId: organization.id,
        projectId: project.id,
        sourceType: 'local_folder',
        sourceUri: './data/media/piercingconnect/inbox',
        sourceLabel: 'PiercingConnect local inbox (seed placeholder)',
        config: {
          note: 'Metadata-only seed record — no ingestion execution',
        },
      },
    });

    await prisma.ingestionJob.upsert({
      where: { id: SAMPLE_INGESTION_JOB_ID },
      update: {
        status: 'completed',
        discoveredAssetCount: 0,
        importedAssetCount: 0,
      },
      create: {
        id: SAMPLE_INGESTION_JOB_ID,
        organizationId: organization.id,
        projectId: project.id,
        ingestionSourceId: ingestionSource.id,
        status: 'completed',
        sourceType: 'local_folder',
        sourceUri: './data/media/piercingconnect/inbox',
        discoveredAssetCount: 0,
        importedAssetCount: 0,
        completedAt: new Date('2026-07-04T12:00:00.000Z'),
      },
    });

    console.log(`Seeded organization: ${organization.slug} (${organization.id})`);
    console.log(`Seeded project: ${project.slug} (${project.id})`);
    console.log(`Seeded sample media asset: ${asset.id} (${asset.storageKey})`);
    console.log(`Seeded ingestion source: ${ingestionSource.id} (${ingestionSource.sourceUri})`);
    console.log(`Seeded ingestion job: ${SAMPLE_INGESTION_JOB_ID} (completed, metadata-only)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
