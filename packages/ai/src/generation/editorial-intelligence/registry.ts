import type { EditorialModuleId } from '@pcme/shared';

import { createAiSeoAnalyzerModule } from './ai-seo/module.js';
import { createCommercialAnalyzerModule } from './commercial/module.js';
import { createEditorialAnalyzerModule } from './editorial/module.js';
import { createEvidenceAnalyzerModule } from './evidence/module.js';
import type { EditorialModule } from './module.js';
import { createSeoAnalyzerModule } from './seo/module.js';
import { createEmptyEditorialModule } from './stub-modules.js';

/** Registry of editorial intelligence modules keyed by module identifier. */
export class EditorialModuleRegistry {
  private readonly modules = new Map<EditorialModuleId, EditorialModule>();

  constructor(modules: readonly EditorialModule[] = []) {
    for (const module of modules) {
      this.register(module);
    }
  }

  register(module: EditorialModule): void {
    if (this.modules.has(module.moduleId)) {
      throw new Error(`Editorial module already registered: ${module.moduleId}`);
    }
    this.modules.set(module.moduleId, module);
  }

  get(moduleId: EditorialModuleId): EditorialModule | undefined {
    return this.modules.get(moduleId);
  }

  list(): readonly EditorialModule[] {
    return Object.freeze([...this.modules.values()]);
  }

  resolveEnabled(moduleIds: readonly EditorialModuleId[]): readonly EditorialModule[] {
    const resolved: EditorialModule[] = [];
    for (const moduleId of moduleIds) {
      const module = this.modules.get(moduleId);
      if (!module) {
        throw new Error(`Editorial module not registered: ${moduleId}`);
      }
      resolved.push(module);
    }
    return Object.freeze(resolved);
  }
}

/** Default registry with empty stub modules for all supported module identifiers. */
export function createDefaultEditorialModuleRegistry(): EditorialModuleRegistry {
  const moduleIds: readonly EditorialModuleId[] = Object.freeze([
    'editorial',
    'evidence',
    'seo',
    'ai-seo',
    'commercial',
    'affiliate',
  ]);

  return new EditorialModuleRegistry(
    moduleIds.map((moduleId) => {
      if (moduleId === 'editorial') {
        return createEditorialAnalyzerModule();
      }
      if (moduleId === 'evidence') {
        return createEvidenceAnalyzerModule();
      }
      if (moduleId === 'seo') {
        return createSeoAnalyzerModule();
      }
      if (moduleId === 'ai-seo') {
        return createAiSeoAnalyzerModule();
      }
      if (moduleId === 'commercial') {
        return createCommercialAnalyzerModule();
      }
      return createEmptyEditorialModule(moduleId);
    }),
  );
}
