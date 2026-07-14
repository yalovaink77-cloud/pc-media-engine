export {
  buildRevisionRequestFromReport,
  type BuildRevisionRequestFromReportInput,
} from './build-revision-request.js';
export { compareRevisionReports } from './compare-reports.js';
export {
  createRevisionArtifact,
  type CreateRevisionArtifactInput,
} from './create-revision-artifact.js';
export {
  createRevisionGenerationJob,
  type CreateRevisionGenerationJobInput,
} from './create-revision-job.js';
export {
  buildDeterministicRevisionArtifactId,
  buildDeterministicRevisionItemId,
  buildDeterministicRevisionJobId,
  buildDeterministicRevisionRequestId,
} from './ids.js';
export {
  assertRevisionCountWithinLimit,
  buildRevisionArtifactLineage,
  DEFAULT_MAX_REVISION_COUNT,
  resolveRevisionNumber,
  resolveRootArtifactId,
} from './lineage.js';
