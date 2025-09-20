#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import process from 'node:process';
import { createMcpServer, loadConfig } from './index';

function printHelp(): void {
  console.info(`Usage: temp-file-share-mcp [options]\n\n` +
    `Options:\n` +
    `  -h, --help          Show this help message.`);
}

function validateArgs(argv: string[]): void {
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
      continue;
    }

    if (arg.startsWith('--')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }
}

async function main(): Promise<void> {
  validateArgs(process.argv);
  const config = loadConfig();

  const { server } = createMcpServer(config);
  const transport = new StdioServerTransport();
  console.info(`temp-file-share-mcp version ${config.app.version}`);
  const stdioCommand = ['npx', '-y', 'temp-file-share-mcp@latest'];
  console.info('temp-file-share-mcp running in stdio mode');
  console.info(`Run via: ${stdioCommand.join(' ')}`);
  console.info('Connect using an MCP client that spawns this command.');
  console.info('Example Cherry Studio config:');
  const envTemplate = {
    TFLINK_USER_ID: process.env.TFLINK_USER_ID ? '<configured via environment>' : '',
    TFLINK_AUTH_TOKEN: process.env.TFLINK_AUTH_TOKEN ? '<configured via environment>' : '',
  };
  console.info(
    JSON.stringify(
      {
        mcpServers: {
          'temp-file-share-mcp': {
            type: 'stdio',
            name: 'temp-file-share-mcp',
            description: 'Upload a local file to tmpfile.link and receive a temporary download URL.',
            command: stdioCommand[0],
            args: stdioCommand.slice(1),
            env: envTemplate,
          },
        },
      },
      null,
      2,
    ),
  );
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof McpError ? error.message : (error as Error).message;
  console.error(message);
  process.exit(error instanceof McpError ? error.code ?? ErrorCode.InternalError : 1);
});
