import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import nock from 'nock';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import { createMcpServer, type AppConfig } from '../../src';
import type { TfLinkUploadResponse } from '../../src/clients/tflink-client';

class LoopbackTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  private peer?: LoopbackTransport;
  private closed = false;

  link(peer: LoopbackTransport): void {
    this.peer = peer;
    peer.peer = this;
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (!this.peer) {
      return Promise.reject(new Error('Loopback transport is not linked to a peer'));
    }

    return new Promise((resolve) => {
      queueMicrotask(() => {
        this.peer?.onmessage?.(message);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }
    this.closed = true;
    this.onclose?.();
    return Promise.resolve();
  }
}

function createLoopbackPair(): { server: LoopbackTransport; client: LoopbackTransport } {
  const server = new LoopbackTransport();
  const client = new LoopbackTransport();
  server.link(client);
  return { server, client };
}

describe('MCP end-to-end integration', () => {
  const BASE_URL = 'https://tmpfile.link';

  afterEach(() => {
    nock.cleanAll();
  });

  it('invokes upload_file_to_get_temp_share_link tool via MCP protocol', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-upload-'));
    const tempFilePath = path.join(tempDir, 'upload.txt');
    await fs.writeFile(tempFilePath, 'hello world');

    const expectedResponse: TfLinkUploadResponse = {
      fileName: 'upload.txt',
      downloadLink: 'https://d.tmpfile.link/public/example/upload.txt',
      downloadLinkEncoded: 'https://d.tmpfile.link/public%2Fexample%2Fupload.txt',
      size: 11,
      type: 'text/plain',
      uploadedTo: 'public',
    };

    const scope = nock(BASE_URL).post('/api/upload').reply(200, expectedResponse);

    const config: AppConfig = {
      app: { name: 'temp-file-share-mcp', version: 'test' },
      tfLink: {
        baseUrl: BASE_URL,
        maxFileSizeBytes: 5 * 1024 * 1024,
        requestTimeoutMs: 5000,
        anonymousRetentionMs: 7 * 24 * 60 * 60 * 1000,
      },
    };

    const { server: serverTransport, client: clientTransport } = createLoopbackPair();

    const { server } = createMcpServer(config);
    const client = new Client({ name: 'integration-client', version: '0.0.1' });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: 'upload_file_to_get_temp_share_link',
      arguments: {
        filePath: tempFilePath,
      },
    });

    expect(scope.isDone()).toBe(true);
      expect(result.content).toEqual([
        {
          type: 'text',
          text: expect.stringContaining('Download URL:'),
        },
      ]);
    expect(result.structuredContent).toMatchObject(expectedResponse);

    const structured = result.structuredContent as TfLinkUploadResponse & {
      expiresAt: string;
    };

    expect(structured.expiresAt).toBeDefined();
    expect(new Date(structured.expiresAt).getTime()).toBeGreaterThan(Date.now());

    await Promise.all([
      client.close(),
      server.close(),
      clientTransport.close(),
      serverTransport.close(),
    ]);

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
