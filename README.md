# temp-file-share-mcp

Model Context Protocol (MCP) server that uploads local files to [tfLink](https://tmpfile.link) and returns shareable download URLs. The server exposes a single tool, `upload_file_to_get_temp_share_link`, which can be used by MCP-compatible assistants or automation environments to share artifacts without provisioning storage.

## Features
- tfLink client with filename sanitisation, file size limits, and optional authenticated uploads.
- MCP tool arguments align with the tmpfile.link upload API (`filePath` plus optional `userId`/`authToken`).
- Minimal stdio transport flow that works entirely on the local machine.
- Configuration via environment variables with sensible defaults (see below).
- Comprehensive Jest tests and an ESLint flat config.

## Installation
```bash
npm install
npm run build
```

## Running the Server
- **npx (recommended)**:
  ```bash
  npx -y temp-file-share-mcp@latest
  ```
- **From source**:
  ```bash
  npm run start
  ```

The CLI prints a ready-to-use Cherry Studio configuration. Because the server runs locally in stdio mode, clients can safely reference files using absolute paths.

Sample configuration emitted on startup:

```json
{
  "mcpServers": {
    "temp-file-share-mcp": {
      "type": "stdio",
      "name": "temp-file-share-mcp",
      "description": "Upload a local file to tmpfile.link and return a temporary download URL.",
      "command": "npx",
      "args": ["-y", "temp-file-share-mcp@latest"],
      "env": {
        "TFLINK_USER_ID": "<configured via environment>",
        "TFLINK_AUTH_TOKEN": "<configured via environment>"
      }
    }
  }
}
```

The tool response includes both the structured metadata above and a plain-text success message containing the download URL plus the encoded variant, making it easy to copy and share.

A manifest example for stdio transport lives in `examples/temp-file-share-mcp.manifest.json`.

### Example Prompt
```
Please use mcp tool to upload `/Users/chris/Downloads/xx.log` and get a temporary download link.
```

## Environment Configuration
| Variable            | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `TFLINK_BASE_URL`   | Override tfLink endpoint (defaults to `https://tmpfile.link`). |
| `TFLINK_MAX_FILE_SIZE_MB` | Maximum upload size guardrail (defaults to `100`). |
| `TFLINK_USER_ID`, `TFLINK_AUTH_TOKEN` | Optional credentials; set these in your shell or MCP client `env` block to enable authenticated uploads. |

## Development
- Lint: `npm run lint`
- Tests: `npm test`
- TypeScript build: `npm run build`

## Official Homepage
Learn more about the project and release updates at [tmpfile.link/temp-file-share-mcp](https://tmpfile.link/temp-file-share-mcp).

## Testing Notes
Critical paths (configuration, tfLink client, and tool wiring) are unit-tested with Jest. Live tfLink integration is intentionally out of scope to avoid leaking credentials; add such checks behind a guarded `LIVE_TFLINK_TEST=1` when required.

## License
ISC
