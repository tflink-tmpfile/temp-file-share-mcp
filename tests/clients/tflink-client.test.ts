import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import nock from 'nock';
import { createTfLinkClient, TfLinkClient, TfLinkClientError } from '../../src/clients/tflink-client';
import type { TfLinkConfig } from '../../src/config';

const BASE_URL = 'https://tmpfile.link';

function createConfig(overrides: Partial<TfLinkConfig> = {}): TfLinkConfig {
  return {
    baseUrl: BASE_URL,
    maxFileSizeBytes: 10 * 1024 * 1024,
    requestTimeoutMs: 5000,
    anonymousRetentionMs: 7 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

describe('TfLinkClient.upload', () => {
  let client: TfLinkClient;
  let tempFilePath: string;
  let tempDir: string;

  beforeEach(async () => {
    nock.cleanAll();
    client = createTfLinkClient(createConfig());
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-test-'));
    tempFilePath = path.join(tempDir, 'upload.txt');
    await fs.writeFile(tempFilePath, 'hello world');
  });

  afterEach(async () => {
    nock.cleanAll();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_error) {
      // ignore missing file
    }
  });

  it('returns upload metadata and computed expiry for anonymous uploads', async () => {
    const expectedResponse = {
      fileName: 'upload.txt',
      downloadLink: 'https://d.tmpfile.link/public/example/upload.txt',
      downloadLinkEncoded: 'https://d.tmpfile.link/public%2Fexample%2Fupload.txt',
      size: 11,
      type: 'text/plain',
      uploadedTo: 'public',
    };

    nock(BASE_URL).post('/api/upload').reply(200, expectedResponse);

    const result = await client.upload({ filePath: tempFilePath });

    expect(result).toMatchObject(expectedResponse);
    expect(result.expiresAt).toBeTruthy();
    expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it('uses provided credentials and disables expiry calculation', async () => {
    const expectedResponse = {
      fileName: 'upload.txt',
      downloadLink: 'https://d.tmpfile.link/public/example/upload.txt',
      downloadLinkEncoded: 'https://d.tmpfile.link/public%2Fexample%2Fupload.txt',
      size: 11,
      type: 'text/plain',
      uploadedTo: 'private',
    };

    const scope = nock(BASE_URL)
      .matchHeader('X-User-Id', 'user-1')
      .matchHeader('X-Auth-Token', 'token-1')
      .post('/api/upload')
      .reply(200, expectedResponse);

    const result = await client.upload({
      filePath: tempFilePath,
      credentials: { userId: 'user-1', authToken: 'token-1' },
    });

    expect(scope.isDone()).toBe(true);
    expect(result.expiresAt).toBeNull();
  });

  it('throws when file exceeds configured size', async () => {
    const largeFilePath = path.join(os.tmpdir(), `large-${Date.now()}.bin`);
    await fs.writeFile(largeFilePath, 'x'.repeat(1024));

    const smallConfig = createConfig({ maxFileSizeBytes: 100 });
    const smallClient = createTfLinkClient(smallConfig);

    await expect(smallClient.upload({ filePath: largeFilePath })).rejects.toThrow(
      TfLinkClientError,
    );

    await fs.unlink(largeFilePath);
  });

  it('throws when tfLink returns an error', async () => {
    nock(BASE_URL).post('/api/upload').reply(500, { message: 'boom' });

    await expect(client.upload({ filePath: tempFilePath })).rejects.toThrow('tfLink');
  });

  it('rejects partial credentials', async () => {
    await expect(
      client.upload({ filePath: tempFilePath, credentials: { userId: 'user' } }),
    ).rejects.toThrow('Both userId');
  });
});
