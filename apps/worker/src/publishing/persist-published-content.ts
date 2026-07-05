import type { PublishedContent, PublishedContentRepository } from '@pcme/database';
import type { PublishingFlowResult } from '@pcme/publishing';

import type { PublishingJobPayload } from '../queue/publishing-payload.js';
import { buildPublishedContentInput } from './published-content-mapper.js';
import type { PublisherDriver } from './publisher-driver.js';

export type PublishedContentWriter = Pick<PublishedContentRepository, 'create' | 'findDuplicate'>;

export async function persistPublishedContentIfSuccessful(
  payload: PublishingJobPayload,
  result: PublishingFlowResult,
  publisher: PublisherDriver,
  repo: PublishedContentWriter,
): Promise<PublishedContent | null> {
  const input = buildPublishedContentInput(payload, result, publisher);
  if (!input) {
    return null;
  }

  return repo.create(input);
}
