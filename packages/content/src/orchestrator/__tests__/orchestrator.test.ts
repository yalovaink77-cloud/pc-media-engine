import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getCommerceContextRecipes } from '../../knowledge/adapters/commerce/context-recipes.js';
import { CommerceKnowledgeSourceAdapter } from '../../knowledge/adapters/commerce-adapter.js';
import { createKnowledgeService } from '../../knowledge/service.js';
import { getCommercePromptContentRecipes } from '../../prompt/index.js';
import { containsBlockedPromptMetadata } from '../../prompt/serialize.js';
import {
  buildDeterministicRequestId,
  createCommerceContentOrchestrator,
  createContentOrchestrator,
} from '../index.js';

const tempDirs: string[] = [];

function withTier0Collections(collections: Record<string, string[]>): Record<string, string[]> {
  return {
    brands: [],
    products: [],
    ...collections,
  };
}

async function createFixtureRepo(collections: Record<string, string[]>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pcme-orchestrator-'));
  tempDirs.push(root);

  for (const [collectionDir, yamlFiles] of Object.entries(withTier0Collections(collections))) {
    const dir = join(root, 'data', collectionDir);
    await mkdir(dir, { recursive: true });
    for (const [index, yaml] of yamlFiles.entries()) {
      await writeFile(join(dir, `record-${index}.yaml`), yaml, 'utf8');
    }
  }

  return realpath(root);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const productFixture = withTier0Collections({
  brands: ['id: neilmed\nslug: neilmed\nname: NeilMed\nproducts:\n  - neilmed-product\n'],
  products: [
    [
      'id: neilmed-product',
      'slug: neilmed-product',
      'name: NeilMed Product',
      'brand: neilmed',
      'category: sterile-saline-spray',
      'ingredients:',
      '  - sterile-water',
      '  - sodium-chloride',
      'healing_stages:',
      '  - fresh-piercing',
      'template_path: /secret/templates/product-review.md',
      'review:',
      '  status: draft',
      '  last_reviewed: 2020-01-01',
    ].join('\n'),
  ],
  ingredients: [
    'id: sterile-water\nslug: sterile-water\nname: Sterile Water\n',
    'id: sodium-chloride\nslug: sodium-chloride\nname: Sodium Chloride\n',
  ],
  'healing-stages': ['id: fresh-piercing\nslug: fresh-piercing\nname: Fresh Piercing\n'],
  'product-categories': [
    'id: sterile-saline-spray\nslug: sterile-saline-spray\nname: Sterile Saline Spray\n',
  ],
});

describe('ContentOrchestrator', () => {
  it('prepares a ready product-review plan', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
      locale: 'en',
      tone: 'educational',
      outputFormat: 'markdown',
    });

    expect(plan.status).toMatch(/^ready/);
    expect(plan.contentType).toBe('product-review');
    expect(plan.contextRecipeId).toBe('product-review');
    expect(plan.promptPayload).toBeDefined();
    expect(plan.metadata.entityCount).toBeGreaterThan(0);
    expect(plan.metadata.promptSectionCount).toBeGreaterThan(0);
    expect(plan.snapshot.snapshotId).toBeTruthy();
  });

  it('prepares a problem-guide plan with safety-first constraints', async () => {
    const repoPath = await createFixtureRepo({
      problems: [
        [
          'id: bump-problem',
          'slug: bump-problem',
          'name: Piercing Bump',
          'symptoms:',
          '  - redness',
        ].join('\n'),
      ],
      symptoms: ['id: redness\nslug: redness\nname: Redness\n'],
      ingredients: [],
      products: [],
    });

    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'problem', id: 'bump-problem' },
      contextRecipe: 'problem-guide',
      contentType: 'problem-guide',
    });

    expect(plan.status).toMatch(/^ready/);
    expect(plan.promptPayload?.constraints.some((c) => c.id === 'no-diagnosis')).toBe(true);
    expect(plan.promptPayload?.outputContract.prohibitedCtaTypes).toContain('commission-first');
    expect(plan.promptPayload?.outputContract.prohibitedCtaTypes).toContain('self-diagnosis');
  });

  it('warns when knowledge entities are draft', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    expect(plan.status).toBe('ready-with-warnings');
    expect(plan.warnings.some((warning) => warning.code === 'draft-knowledge-entity')).toBe(true);
  });

  it('warns for optional missing context in non-strict mode', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'solo' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
      strict: false,
    });

    expect(plan.status).toBe('ready-with-warnings');
    expect(plan.warnings.some((warning) => warning.code === 'missing-required-type')).toBe(true);
  });

  it('blocks strict missing required context', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'solo' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
      strict: true,
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockReason).toContain('missing required entity types');
    expect(plan.promptPayload).toBeUndefined();
  });

  it('blocks incompatible recipe and content type pairs', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-comparison',
      contentType: 'product-review',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockReason).toContain('Incompatible context recipe');
  });

  it('returns deterministic plans for identical requests', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const knowledgeService = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });
    const orchestrator = createContentOrchestrator({
      knowledgeService,
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const request = {
      root: { type: 'product' as const, id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
      locale: 'en',
      tone: 'educational',
      outputFormat: 'markdown' as const,
    };

    const first = await orchestrator.prepare(request);
    const second = await orchestrator.prepare(request);

    expect(first.requestId).toBe(second.requestId);
    expect(JSON.stringify(first.promptPayload?.userSections)).toBe(
      JSON.stringify(second.promptPayload?.userSections),
    );
    expect(JSON.stringify(first.warnings)).toBe(JSON.stringify(second.warnings));
  });

  it('does not leak blocked metadata into prompt payload', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    const serialized = JSON.stringify(plan.promptPayload);
    expect(serialized).not.toContain('template_path');
    expect(serialized).not.toContain('/secret/templates');

    for (const section of plan.promptPayload?.userSections ?? []) {
      expect(containsBlockedPromptMetadata(section.content)).toBe(false);
    }
  });

  it('preserves snapshot metadata on the plan', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const knowledgeService = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });
    const orchestrator = createContentOrchestrator({
      knowledgeService,
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const snapshot = await knowledgeService.getSnapshot();
    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    expect(plan.snapshot.snapshotId).toBe(snapshot.snapshotId);
    expect(plan.snapshot.sourceId).toBe(snapshot.sourceId);
    expect(plan.snapshot.sourceType).toBe(snapshot.sourceType);
    expect(plan.sourceReference.sourceId).toBe(snapshot.sourceId);
  });

  it('uses deterministic request IDs', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const knowledgeService = await createKnowledgeService({
      adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
    });
    const snapshot = await knowledgeService.getSnapshot();
    const request = {
      root: { type: 'product' as const, id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    };

    const expected = buildDeterministicRequestId(request, snapshot.sourceId);
    const orchestrator = createContentOrchestrator({
      knowledgeService,
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare(request);
    expect(plan.requestId).toBe(expected);
    expect(plan.metadata.requestId).toBe(expected);
  });

  it('normalizes warnings from multiple layers', async () => {
    const repoPath = await createFixtureRepo({
      products: ['id: solo\nslug: solo\nname: Solo Product\n'],
      brands: [],
      ingredients: [],
      'healing-stages': [],
      'product-categories': [],
    });

    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'solo' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    expect(plan.warnings.every((warning) => warning.source.length > 0)).toBe(true);
    expect(plan.warnings).toEqual(
      [...plan.warnings].sort((a, b) => {
        const sourceOrder = a.source.localeCompare(b.source);
        if (sourceOrder !== 0) {
          return sourceOrder;
        }
        return a.code.localeCompare(b.code);
      }),
    );
  });

  it('blocks unsupported content types', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = createContentOrchestrator({
      knowledgeService: await createKnowledgeService({
        adapter: new CommerceKnowledgeSourceAdapter({ repoPath }),
      }),
      contextRecipes: getCommerceContextRecipes(),
      promptRecipes: getCommercePromptContentRecipes(),
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'unknown-content-type',
    });

    expect(plan.status).toBe('blocked');
    expect(plan.blockReason).toContain('Unsupported content type');
  });

  it('creates commerce orchestrator via convenience factory', async () => {
    const repoPath = await createFixtureRepo(productFixture);
    const orchestrator = await createCommerceContentOrchestrator({
      commerce: { repoPath },
    });

    const plan = await orchestrator.prepare({
      root: { type: 'product', id: 'neilmed-product' },
      contextRecipe: 'product-review',
      contentType: 'product-review',
    });

    expect(plan.contentType).toBe('product-review');
    expect(plan.promptPayload).toBeDefined();
  });
});
