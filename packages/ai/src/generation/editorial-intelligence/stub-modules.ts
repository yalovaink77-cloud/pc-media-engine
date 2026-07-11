import type { EditorialModuleId } from '@pcme/shared';

import type { EditorialModule } from './module.js';

/** Create a module stub that always returns empty findings. */
export function createEmptyEditorialModule(moduleId: EditorialModuleId): EditorialModule {
  return Object.freeze({
    moduleId,
    analyze: () => Object.freeze([]),
  });
}
