import {
  type CallToolResult,
  type ServerNotification,
  type ServerRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  RequestHandlerExtra,
  RequestOptions,
} from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ZodType } from 'zod';
import { registerUploadFileToTempShareLinkTool } from '../../src/tools/upload-file-to-temp-share-link-tool';
import type { TfLinkClient, UploadResult } from '../../src/clients/tflink-client';

function createUploadResult(overrides: Partial<UploadResult> = {}): UploadResult {
  const base: UploadResult = {
    fileName: 'file.txt',
    downloadLink: 'https://d.tmpfile.link/public/example/file.txt',
    downloadLinkEncoded: 'https://d.tmpfile.link/public%2Fexample%2Ffile.txt',
    size: 10,
    type: 'text/plain',
    uploadedTo: 'public',
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  };

  return { ...base, ...overrides };
}

describe('registerUploadFileToTempShareLinkTool', () => {
  it('invokes client.upload and wraps response as JSON content', async () => {
    const uploadResult = createUploadResult();
    const uploadMock = jest
      .fn<ReturnType<TfLinkClient['upload']>, Parameters<TfLinkClient['upload']>>()
      .mockResolvedValue(uploadResult);

    const client: Pick<TfLinkClient, 'upload'> = { upload: uploadMock };

    const { handler } = createRegisteredUploadTool(client);

    const result = await handler(
      { filePath: '/tmp/file.txt' },
      createRequestExtra('session-1'),
    );

    expect(uploadMock).toHaveBeenCalledWith({
      filePath: '/tmp/file.txt',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('Download URL:'),
      },
    ]);
    expect(result.structuredContent).toEqual(uploadResult);
  });

});

type UploadToolHandler = (
  input: unknown,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => CallToolResult | Promise<CallToolResult>;

function createRegisteredUploadTool(
  client: Pick<TfLinkClient, 'upload'>,
): {
  handler: UploadToolHandler;
} {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  const registerToolSpy = jest.spyOn(server, 'registerTool');
  jest.spyOn(server, 'sendLoggingMessage').mockResolvedValue(undefined);

  registerUploadFileToTempShareLinkTool(server, { client: client as TfLinkClient });

  const call = registerToolSpy.mock.calls[0];
  if (!call) {
    throw new Error('Tool was not registered');
  }

  const handler = call[2] as UploadToolHandler;

  return { handler };
}

function createRequestExtra(
  sessionId?: string,
): RequestHandlerExtra<ServerRequest, ServerNotification> {
  const controller = new AbortController();

  const extra: RequestHandlerExtra<ServerRequest, ServerNotification> = {
    signal: controller.signal,
    requestId: 'req-1',
    sendNotification: async (_notification: ServerNotification) => {
      // no-op for tests
    },
    sendRequest: (
      _request: ServerRequest,
      _resultSchema: ZodType<object>,
      _options?: RequestOptions,
    ) =>
      Promise.reject(new Error('sendRequest is not implemented in tests')),
  };

  if (sessionId !== undefined) {
    extra.sessionId = sessionId;
  }

  return extra;
}
