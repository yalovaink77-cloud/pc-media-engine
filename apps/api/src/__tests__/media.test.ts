import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalStorageProvider } from '@pcme/media';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppOptions } from '../app.js';
import { buildApp } from '../app.js';
import type { JobScheduler, ScheduledJob } from '../orchestration/processing.orchestrator.js';
import type { ProcessingEnqueuer } from '../queue/processing-enqueue.js';
import type { AssetCreator, StoredAsset, UploadResponse } from '../routes/media.js';
import { UPLOAD_ALLOWED_MIME_TYPES } from '../routes/media.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOUNDARY = 'TestBoundary999';
const CRLF = '\r\n';

function buildMultipartBody(
  filename: string,
  contentType: string,
  content: Buffer | string,
): Buffer {
  const header = Buffer.from(
    `--${BOUNDARY}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}` +
      CRLF,
  );
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const footer = Buffer.from(`${CRLF}--${BOUNDARY}--${CRLF}`);
  return Buffer.concat([header, body, footer]);
}

function multipartHeaders(boundary = BOUNDARY) {
  return { 'content-type': `multipart/form-data; boundary=${boundary}` };
}

/** Minimal asset mock returned by the mock repository. */
function makeAssetMock(overrides: Partial<StoredAsset> = {}): StoredAsset {
  return {
    id: 'aabbccddeeff00112233445566778899',
    filename: 'test.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 100,
    storageKey: 'piercingconnect/aabbccddeeff00112233445566778899/test.jpg',
    status: 'pending',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture: per-test temp storage dir + mock repository
// ---------------------------------------------------------------------------

const baseConfig = {
  port: 3001,
  host: '127.0.0.1',
  logLevel: 'silent',
  env: 'test',
  version: '0.0.0-test',
  databaseUrl: undefined,
  storageLocalRoot: '',
  defaultOrgId: 'org-test',
  defaultProjectId: 'proj-test',
  defaultProjectSlug: 'piercingconnect',
  redisUrl: undefined,
  autoEnqueueProcessing: false,
};

let tmpDir: string;
let mockCreate: ReturnType<typeof vi.fn>;
let mockFindByAssetAndType: ReturnType<typeof vi.fn>;
let mockJobCreate: ReturnType<typeof vi.fn>;
let app: ReturnType<typeof buildApp>;

function makeApp(overrides: Partial<AppOptions> = {}): ReturnType<typeof buildApp> {
  const storageProvider = new LocalStorageProvider({ rootDir: tmpDir });
  const assetRepository: AssetCreator = { create: mockCreate };
  const jobScheduler: JobScheduler = {
    findByAssetAndType: mockFindByAssetAndType,
    create: mockJobCreate,
  };

  return buildApp({
    config: { ...baseConfig, storageLocalRoot: tmpDir },
    assetRepository,
    storageProvider,
    jobScheduler,
    ...overrides,
  });
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'pcme-upload-test-'));
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  mockCreate = vi
    .fn()
    .mockImplementation(
      (input: {
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        storageKey: string;
      }) =>
        Promise.resolve(
          makeAssetMock({
            id: input.id,
            filename: input.filename,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            storageKey: input.storageKey,
          }),
        ),
    );

  // Sprint 10 processing job mocks: by default no pre-existing job
  mockFindByAssetAndType = vi.fn().mockResolvedValue(null);
  mockJobCreate = vi.fn().mockImplementation((input: { assetId: string; processingType: string }) =>
    Promise.resolve<ScheduledJob>({
      id: `job-${input.processingType}-${input.assetId.slice(0, 8)}`,
      processingType: input.processingType,
      status: 'pending',
    }),
  );

  app = makeApp();
});

afterEach(async () => {
  await app.close();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /media — successful upload
// ---------------------------------------------------------------------------

describe('POST /media — successful upload', () => {
  it('returns 201 on valid JPEG upload', async () => {
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('fake jpeg bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(201);
  });

  it('returns correct response shape', async () => {
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('fake jpeg bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();
    expect(json).toMatchObject({
      id: expect.any(String),
      filename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: expect.any(Number),
      storageKey: expect.stringMatching(/^piercingconnect\/.+\/photo\.jpg$/),
      status: 'pending',
    });
  });

  it('passes correct sizeBytes to the repository', async () => {
    const content = Buffer.from('exactly nineteen');
    const body = buildMultipartBody('size.jpg', 'image/jpeg', content);
    await app.inject({ method: 'POST', url: '/media', headers: multipartHeaders(), body });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: content.length }));
  });

  it('stores the file using LocalStorageProvider', async () => {
    const content = Buffer.from('test image data');
    const body = buildMultipartBody('stored.jpg', 'image/jpeg', content);
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();

    const provider = new LocalStorageProvider({ rootDir: tmpDir });
    const exists = await provider.exists(json.storageKey);
    expect(exists).toBe(true);
  });

  it('does NOT call the processing job scheduler when no scheduler is injected', async () => {
    // Build an app without a jobScheduler — backward-compat check
    const noSchedulerApp = makeApp({ jobScheduler: undefined });
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await noSchedulerApp.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    await noSchedulerApp.close();
    expect(res.statusCode).toBe(201);
    // mockJobCreate was never reached
    expect(mockJobCreate).not.toHaveBeenCalled();
  });

  it('accepts image/png', async () => {
    const body = buildMultipartBody('image.png', 'image/png', Buffer.from('png bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(201);
  });

  it('accepts image/webp', async () => {
    const body = buildMultipartBody('image.webp', 'image/webp', Buffer.from('webp bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(201);
  });

  it('storageKey follows {projectSlug}/{assetId}/{filename} pattern', async () => {
    const body = buildMultipartBody('hero.jpg', 'image/jpeg', Buffer.from('img'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();
    const parts = json.storageKey.split('/');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('piercingconnect');
    expect(parts[2]).toBe('hero.jpg');
  });
});

// ---------------------------------------------------------------------------
// POST /media — validation failures
// ---------------------------------------------------------------------------

describe('POST /media — validation failures', () => {
  it('returns 400 when no file is provided (empty multipart body)', async () => {
    // Send a multipart form with no file part
    const body = Buffer.from(`--${BOUNDARY}--${CRLF}`);
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 415 for an unsupported MIME type', async () => {
    const body = buildMultipartBody('doc.pdf', 'application/pdf', Buffer.from('pdf content'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(415);
  });

  it('415 response includes allowed MIME types', async () => {
    const body = buildMultipartBody('clip.mp4', 'video/mp4', Buffer.from('video'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<{ error: string; allowed: string[] }>();
    expect(json.allowed).toEqual(expect.arrayContaining([...UPLOAD_ALLOWED_MIME_TYPES]));
  });

  it('returns 400 for an empty file', async () => {
    const body = buildMultipartBody('empty.jpg', 'image/jpeg', Buffer.alloc(0));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    expect(res.statusCode).toBe(400);
  });

  it('does not call the repository on validation failure', async () => {
    const body = buildMultipartBody('bad.gif', 'image/gif', Buffer.from('gif bytes'));
    await app.inject({ method: 'POST', url: '/media', headers: multipartHeaders(), body });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// UPLOAD_ALLOWED_MIME_TYPES constant
// ---------------------------------------------------------------------------

describe('UPLOAD_ALLOWED_MIME_TYPES', () => {
  it('contains image/jpeg, image/png, image/webp', () => {
    expect(UPLOAD_ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(UPLOAD_ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(UPLOAD_ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
  });

  it('does not contain image/gif or application/pdf', () => {
    expect(UPLOAD_ALLOWED_MIME_TYPES.has('image/gif' as never)).toBe(false);
    expect(UPLOAD_ALLOWED_MIME_TYPES.has('application/pdf' as never)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /media — Sprint 10: processing orchestration
// ---------------------------------------------------------------------------

describe('POST /media — processing orchestration', () => {
  it('response includes processingJobs array', async () => {
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();
    expect(json).toHaveProperty('processingJobs');
    expect(Array.isArray(json.processingJobs)).toBe(true);
  });

  it('creates exactly one pending thumbnail ProcessingJob on upload', async () => {
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    await app.inject({ method: 'POST', url: '/media', headers: multipartHeaders(), body });

    // scheduler.create called once for thumbnail
    expect(mockJobCreate).toHaveBeenCalledTimes(1);
    expect(mockJobCreate).toHaveBeenCalledWith(
      expect.objectContaining({ processingType: 'thumbnail' }),
    );
  });

  it('returned processingJobs contains the thumbnail job with status pending', async () => {
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();
    expect(json.processingJobs).toHaveLength(1);
    expect(json.processingJobs[0]).toMatchObject({
      id: expect.any(String),
      processingType: 'thumbnail',
      status: 'pending',
    });
  });

  it('does not create a duplicate job when one already exists (idempotent)', async () => {
    // Pre-seed findByAssetAndType to return an existing job
    const existingJob: ScheduledJob = {
      id: 'existing-job-id',
      processingType: 'thumbnail',
      status: 'pending',
    };
    mockFindByAssetAndType.mockResolvedValue(existingJob);

    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await app.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    const json = res.json<UploadResponse>();

    // create() was never called on the scheduler
    expect(mockJobCreate).not.toHaveBeenCalled();
    // existing job is returned in the array
    expect(json.processingJobs).toHaveLength(1);
    expect(json.processingJobs[0]!.id).toBe('existing-job-id');
  });

  it('does not call job scheduler when upload validation fails (unsupported MIME)', async () => {
    const body = buildMultipartBody('bad.gif', 'image/gif', Buffer.from('gif'));
    await app.inject({ method: 'POST', url: '/media', headers: multipartHeaders(), body });
    expect(mockJobCreate).not.toHaveBeenCalled();
    expect(mockFindByAssetAndType).not.toHaveBeenCalled();
  });

  it('does not call job scheduler when upload validation fails (empty file)', async () => {
    const body = buildMultipartBody('empty.jpg', 'image/jpeg', Buffer.alloc(0));
    await app.inject({ method: 'POST', url: '/media', headers: multipartHeaders(), body });
    expect(mockJobCreate).not.toHaveBeenCalled();
    expect(mockFindByAssetAndType).not.toHaveBeenCalled();
  });

  it('processingJobs is empty array when no scheduler is injected', async () => {
    const noSchedulerApp = makeApp({ jobScheduler: undefined });
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await noSchedulerApp.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    await noSchedulerApp.close();
    const json = res.json<UploadResponse>();
    expect(json.processingJobs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /media — Sprint 21: optional processing enqueue
// ---------------------------------------------------------------------------

describe('POST /media — processing enqueue (Sprint 21)', () => {
  it('does not call processingEnqueuer when not injected', async () => {
    const mockEnqueuer: ProcessingEnqueuer = {
      enqueueProcessingJobs: vi.fn().mockResolvedValue(undefined),
    };
    const noEnqueuerApp = makeApp();
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    await noEnqueuerApp.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    await noEnqueuerApp.close();
    expect(mockEnqueuer.enqueueProcessingJobs).not.toHaveBeenCalled();
  });

  it('enqueues processing jobs when processingEnqueuer is injected', async () => {
    const mockEnqueuer: ProcessingEnqueuer = {
      enqueueProcessingJobs: vi.fn().mockResolvedValue(undefined),
    };
    const enqueueApp = makeApp({ processingEnqueuer: mockEnqueuer });
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    const res = await enqueueApp.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    await enqueueApp.close();

    expect(res.statusCode).toBe(201);
    expect(mockEnqueuer.enqueueProcessingJobs).toHaveBeenCalledTimes(1);
    expect(mockEnqueuer.enqueueProcessingJobs).toHaveBeenCalledWith([
      expect.objectContaining({ processingType: 'thumbnail', status: 'pending' }),
    ]);
  });

  it('does not enqueue when job scheduler is absent', async () => {
    const mockEnqueuer: ProcessingEnqueuer = {
      enqueueProcessingJobs: vi.fn().mockResolvedValue(undefined),
    };
    const noSchedulerApp = makeApp({ jobScheduler: undefined, processingEnqueuer: mockEnqueuer });
    const body = buildMultipartBody('photo.jpg', 'image/jpeg', Buffer.from('bytes'));
    await noSchedulerApp.inject({
      method: 'POST',
      url: '/media',
      headers: multipartHeaders(),
      body,
    });
    await noSchedulerApp.close();
    expect(mockEnqueuer.enqueueProcessingJobs).not.toHaveBeenCalled();
  });
});
