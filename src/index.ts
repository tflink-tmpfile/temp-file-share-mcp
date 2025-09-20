import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from './config';
import { loadConfig } from './config';
import { createTfLinkClient, TfLinkClient } from './clients/tflink-client';
import { registerUploadFileToTempShareLinkTool } from './tools/upload-file-to-temp-share-link-tool';

export interface ServerContext {
  server: McpServer;
  client: TfLinkClient;
  config: AppConfig;
}

export function createMcpServer(config: AppConfig = loadConfig()): ServerContext {
  const server = new McpServer({
    name: config.app.name,
    version: config.app.version,
  });

  const client = createTfLinkClient(config.tfLink);

  registerUploadFileToTempShareLinkTool(server, { client });

  return { server, client, config };
}

export * from './config';
export * from './clients/tflink-client';
export * from './tools/upload-file-to-temp-share-link-tool';
