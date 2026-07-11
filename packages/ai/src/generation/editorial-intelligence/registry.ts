import type { EditorialModuleId } from '@pcme/shared';

import { createEditorialAnalyzerModule } from './editorial/module.js';
import type { EditorialModule } from './module.js';
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
    'affiliate',
  ]);

  return new EditorialModuleRegistry(
    moduleIds.map((moduleId) =>
      moduleId === 'editorial'
        ? createEditorialAnalyzerModule()
        : createEmptyEditorialModule(moduleId),
    ),
  );
}
