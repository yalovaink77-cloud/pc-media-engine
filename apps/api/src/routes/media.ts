import { randomUUID } from 'node:crypto';

import multipart from '@fastify/multipart';
import type { AssetStatus, CreateMediaAssetInput } from '@pcme/database';
import { buildStorageKeyPlaceholder } from '@pcme/database';
import type { FastifyInstance } from 'fastify';

import type { JobScheduler, ScheduledJob } from '../orchestration/processing.orchestrator.js';
import { scheduleDefaultJobs } from '../orchestration/processing.orchestrator.js';
import type { ProcessingEnqueuer } from '../queue/processing-enqueue.js';

// ---------------------------------------------------------------------------
// Injection interfaces (kept minimal so tests can pass plain objects)
// ---------------------------------------------------------------------------

/** The fields the upload route reads back from a created asset record. */
export type StoredAsset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  /** String value from AssetStatus enum (e.g. 'pending', 'ready'). */
  status: string;
};

export interface AssetCreator {
  create(input: CreateMediaAssetInput): Promise<StoredAsset>;
}

export interface FileStorer {
  put(key: string, buffer: Buffer, mimeType: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
] as const);

/** 50 MB ceiling on single-file uploads (enforced by @fastify/multipart). */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export type MediaRouteOptions = {
  assetRepository: AssetCreator;
  storageProvider: FileStorer;
  /**
   * Optional processing job scheduler.
   * If omitted, no ProcessingJob records are created (backward compatible).
   */
  jobScheduler?: JobScheduler;
  /**
   * Optional BullMQ enqueuer (Sprint 21+).
   * When set, pending processing jobs are enqueued after upload.
   */
  processingEnqueuer?: ProcessingEnqueuer;
  organizationId: string;
  projectId: string;
  projectSlug: string;
};

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export type ProcessingJobSummary = {
  id: string;
  processingType: string;
  status: string;
};

export type UploadResponse = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: string;
  processingJobs: ProcessingJobSummary[];
};

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function mediaRoutes(app: FastifyInstance, options: MediaRouteOptions): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  });

  app.post<{ Reply: UploadResponse | { error: string; allowed?: string[] } }>(
    '/media',
    {
      schema: {
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              filename: { type: 'string' },
              mimeType: { type: 'string' },
              sizeBytes: { type: 'number' },
              storageKey: { type: 'string' },
              status: { type: 'string' },
              processingJobs: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    processingType: { type: 'string' },
                    status: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // -------------------------------------------------------------------
      // 1. Parse multipart
      // -------------------------------------------------------------------
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({ error: 'File is required' });
      }

      // -------------------------------------------------------------------
      // 2. Validate filename
      // -------------------------------------------------------------------
      const rawFilename = file.filename?.trim() ?? '';
      if (!rawFilename) {
        // Drain stream to avoid hanging connection
        file.file.resume();
        return reply.status(400).send({ error: 'Filename is required' });
      }

      // -------------------------------------------------------------------
      // 3. Validate MIME type (from multipart Content-Type, not extension)
      // -------------------------------------------------------------------
      const mimeType = file.mimetype?.trim().toLowerCase() ?? '';
      if (!UPLOAD_ALLOWED_MIME_TYPES.has(mimeType as 'image/jpeg' | 'image/png' | 'image/webp')) {
        file.file.resume();
        return reply.status(415).send({
          error: 'Unsupported media type',
          allowed: [...UPLOAD_ALLOWED_MIME_TYPES],
        });
      }

      // -------------------------------------------------------------------
      // 4. Read buffer + validate size
      // -------------------------------------------------------------------
      const buffer = await file.toBuffer();

      if (buffer.length === 0) {
        return reply.status(400).send({ error: 'File must not be empty' });
      }

      // -------------------------------------------------------------------
      // 5. Generate asset ID + deterministic storageKey
      //    UUID without hyphens → 32 hex chars, passes alphanumeric check
      // -------------------------------------------------------------------
      const assetId = randomUUID().replace(/-/g, '');
      const storageKey = buildStorageKeyPlaceholder(options.projectSlug, assetId, rawFilename);

      // -------------------------------------------------------------------
      // 6. Write to storage
      // -------------------------------------------------------------------
      await options.storageProvider.put(storageKey, buffer, mimeType);

      // -------------------------------------------------------------------
      // 7. Create Asset record in database
      // -------------------------------------------------------------------
      const asset = await options.assetRepository.create({
        id: assetId,
        organizationId: options.organizationId,
        projectId: options.projectId,
        filename: rawFilename,
        originalFilename: rawFilename,
        mimeType,
        storageProvider: 'local',
        storageKey,
        sizeBytes: buffer.length,
        status: 'pending' as AssetStatus,
      });

      // -------------------------------------------------------------------
      // 8. Schedule processing jobs (Sprint 10+)
      //    No execution — jobs remain pending until a worker picks them up.
      // -------------------------------------------------------------------
      let processingJobs: ScheduledJob[] = [];
      if (options.jobScheduler) {
        processingJobs = await scheduleDefaultJobs(options.jobScheduler, {
          organizationId: options.organizationId,
          projectId: options.projectId,
          assetId: asset.id,
        });
      }

      if (options.processingEnqueuer && processingJobs.length > 0) {
        await options.processingEnqueuer.enqueueProcessingJobs(
          processingJobs.map((j) => ({
            id: j.id,
            processingType: j.processingType,
            status: j.status,
          })),
        );
      }

      // -------------------------------------------------------------------
      // 9. Return 201
      // -------------------------------------------------------------------
      return reply.status(201).send({
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        storageKey: asset.storageKey,
        status: asset.status,
        processingJobs: processingJobs.map((j) => ({
          id: j.id,
          processingType: j.processingType,
          status: j.status,
        })),
      });
    },
  );
}
