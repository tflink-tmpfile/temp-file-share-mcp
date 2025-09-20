import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { TfLinkClient, UploadResult } from '../clients/tflink-client';
import { TfLinkClientError } from '../clients/tflink-client';

const uploadFileToTempShareLinkInputSchema = z.object({
  filePath: z.string().min(1, 'filePath is required'),
});

const uploadFileToTempShareLinkOutputSchema = {
  fileName: z.string(),
  downloadLink: z.string(),
  downloadLinkEncoded: z.string(),
  size: z.number(),
  type: z.string(),
  uploadedTo: z.string(),
  expiresAt: z.string().nullable(),
};

export type UploadFileToTempShareLinkInput = z.infer<
  typeof uploadFileToTempShareLinkInputSchema
>;

export function registerUploadFileToTempShareLinkTool(
  server: McpServer,
  dependencies: { client: TfLinkClient },
): void {
  server.registerTool(
    'upload_file_to_get_temp_share_link',
    {
      title: 'Upload File To Get Temp Share Link',
      description:
        'Upload a readable local file to tmpfile.link and receive a temporary download URL. ' +
        'Provide an absolute path that the MCP server can read; optional authenticated uploads use ' +
        'environment variables TFLINK_USER_ID and TFLINK_AUTH_TOKEN when present.',
      inputSchema: uploadFileToTempShareLinkInputSchema.shape,
      outputSchema: uploadFileToTempShareLinkOutputSchema,
    },
    async (input, extra): Promise<CallToolResult> => {
      const parsed = uploadFileToTempShareLinkInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new McpError(ErrorCode.InvalidParams, parsed.error.message);
      }

      const params = parsed.data;

      const result = await executeUpload(dependencies, params);

      const sessionId = extra.sessionId ?? undefined;
      await maybeLog(server, sessionId, `Uploaded ${result.fileName} (${result.size} bytes)`);

      return {
        content: [
          {
            type: 'text',
            text: formatSuccessMessage(result),
          },
        ],
        structuredContent: result,
      };
    },
  );
}

async function maybeLog(server: McpServer, sessionId: string | undefined, message: string): Promise<void> {
  try {
    await server.sendLoggingMessage(
      {
        level: 'info',
        logger: 'temp-file-share-mcp',
        message,
      },
      sessionId,
    );
  } catch (error) {
    // Logging should never block tool execution, so swallow errors.
    if (error instanceof Error) {
      // eslint-disable-next-line no-console
      console.debug('Failed to emit MCP log message', error);
    }
  }
}

async function executeUpload(
  dependencies: { client: TfLinkClient },
  params: UploadFileToTempShareLinkInput,
): Promise<UploadResult> {
  try {
    const uploadRequest: Parameters<TfLinkClient['upload']>[0] = {
      filePath: params.filePath,
    };

    return await dependencies.client.upload(uploadRequest);
  } catch (error) {
    if (error instanceof TfLinkClientError) {
      throw new McpError(ErrorCode.InternalError, error.message);
    }
    throw error;
  }
}

function formatSuccessMessage(result: UploadResult): string {
  const expires = result.expiresAt ? ` (expires ${result.expiresAt})` : '';
  return [
    `Upload successful: ${result.fileName} (${result.size} bytes)${expires}.`,
    `Download URL: ${result.downloadLink}.`,
    `Encoded URL: ${result.downloadLinkEncoded}.`,
  ].join(' ');
}
