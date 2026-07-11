import type { ContentPipelineStageTiming } from './types.js';

export async function runTimedStage<T>(
  stage: string,
  startedAt: Date,
  fn: () => Promise<T> | T,
): Promise<{ result: T; timing: ContentPipelineStageTiming }> {
  const stageStart = startedAt;
  const result = await fn();
  const completedAt = new Date();
  return {
    result,
    timing: Object.freeze({
      stage,
      startedAt: stageStart.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - stageStart.getTime(),
    }),
  };
}

export function sumStageDurations(stages: readonly ContentPipelineStageTiming[]): number {
  return stages.reduce((total, stage) => total + stage.durationMs, 0);
}
