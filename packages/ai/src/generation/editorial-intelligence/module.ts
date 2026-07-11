import type {
  EditorialIntelligenceFinding,
  EditorialIntelligenceProfile,
  EditorialModuleId,
} from '@pcme/shared';

import type { GeneratedContentArtifact } from '../artifact/types.js';

/** Input passed to an editorial intelligence module analyzer. */
export interface EditorialModuleAnalysisInput {
  readonly artifact: GeneratedContentArtifact;
  readonly profile: EditorialIntelligenceProfile;
  readonly analyzedAt: string;
  readonly reportId: string;
}

/** Contract for a single editorial intelligence module analyzer. */
export interface EditorialModule {
  readonly moduleId: EditorialModuleId;
  analyze(input: EditorialModuleAnalysisInput): readonly EditorialIntelligenceFinding[];
}
