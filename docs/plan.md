# temp-file-share-mcp Project Plan

## 1. Vision & Scope
- Build a Model Context Protocol (MCP) server that exposes temporary file sharing capabilities backed by [tfLink](https://tmpfile.link).
- Default uploads occur anonymously; if callers provide tfLink credentials the server attaches them so tfLink treats the upload as authenticated.
- Deliver a reusable MCP tool that large-model assistants or other MCP-aware clients can call to upload arbitrary files and receive shareable download URLs.

## 2. Target Use Cases
- **LLM toolchains** needing to share artifacts (logs, notebooks, patches) via expiring public links.
- **Automation scripts** (CLI or headless agents) that must hand off files to collaborators without managing storage.
- **Authenticated workflows** where the operator has tfLink user credentials and wants longer retention or user-specific buckets.

## 3. High-Level Architecture
1. **MCP Server Runtime**
   - Implemented in Node.js (TypeScript preferred) using Anthropic's `@modelcontextprotocol/sdk`.
   - Exposes at least one tool (e.g., `upload_file_to_get_temp_share_link`) via MCP JSON-RPC over stdio.
2. **tfLink Client Layer**
   - Minimal wrapper around `POST https://tmpfile.link/api/upload`.
   - Handles multipart form construction, optional headers `X-User-Id` & `X-Auth-Token`, and response validation.
3. **Configuration Management**
   - Server reads configuration from environment variables and/or a JSON config file (honoring MCP manifest conventions).
   - Key settings: default tfLink base URL, optional static credentials, maximum allowed upload size overrides, timeout.
4. **Request Flow**
   - Client invokes MCP tool with parameters (file path, optional tfLink credentials).
   - Server verifies file existence and size, constructs multipart request, streams file to tfLink, and returns tfLink JSON payload plus helper fields (expiry estimate, qr-code-ready URL, etc.).
5. **Error Handling & Telemetry**
   - Normalize tfLink errors into MCP `ToolError` responses with actionable messages.
   - Log structured events (upload start/finish) to stderr for observability.

## 4. Interfaces & Data Model
### 4.1 MCP Tool: `upload_file_to_get_temp_share_link`
- **Inputs**
  - `filePath` *(string, required)*: local path to the file to upload.
  - `userId` *(string, optional)* and `authToken` *(string, optional)*: tfLink credentials; if provided as a pair they are sent via headers.
- **Outputs**
  - `fileName`, `downloadLink`, `downloadLinkEncoded`, `size`, `type`, `uploadedTo` from tfLink.
  - `expiresAt` *(ISO string)*: computed as upload timestamp + 7 days when anonymous, otherwise null (unknown) unless future docs provide retention info.

### 4.2 Future Tools (Backlog)
- `get_upload_status` if tfLink adds status endpoints.
- `delete_uploaded_file` contingent on API support (currently unavailable for anonymous uploads).

## 5. Configuration Strategy
- **Environment Variables**
  - `TFLINK_BASE_URL` (default `https://tmpfile.link`).
  - `TFLINK_USER_ID`, `TFLINK_AUTH_TOKEN` for system-level credentials (optional).
  - `TFLINK_MAX_FILE_SIZE_MB` to guard against accidental large uploads (default 100 per tfLink policy).
  - `HTTP_REQUEST_TIMEOUT_MS` for outbound uploads.
- **Manifest / Settings**
  - Provide MCP server manifest (`mcp.json` or similar) documenting tool parameters and default configuration.
  - Support runtime overrides via CLI flags if needed (e.g., `--config` path).

## 6. Security & Privacy Considerations
- Never log authentication headers or tokens.
- Sanitize file names before sending to tfLink to avoid path traversal or control characters.
- Enforce size checks locally before upload to respect tfLink 100 MB limit (or configured cap).
- Consider opt-in hashing of files (SHA-256) for verification without exposing contents in logs.
- Validate responses to ensure returned URLs use expected tfLink CDN host (`https://d.tmpfile.link/`).

## 7. Testing Approach
- **Unit Tests**: mock tfLink responses using Nock / MSW to validate multipart construction, credential handling, and error translation.
- **Integration Smoke Test**: optional e2e script (behind env flag) that uploads a small text file to live tfLink when credentials and network access are available.
- **Schema Tests**: ensure MCP tool input/output schema matches documentation and rejects malformed inputs.

## 8. Delivery Roadmap
1. **Project Scaffolding**
   - Initialize Node.js project, add TypeScript, linting, testing tooling, MCP dependencies.
   - Create manifest and basic server entry point.
2. **tfLink Client Implementation**
   - Write upload helper with multipart form, header injection, response parsing, and size checks.
3. **MCP Tool Wiring**
   - Implement `upload_file_to_get_temp_share_link` tool, integrate config, map results to MCP protocol structures.
4. **Validation & Docs**
   - Add unit tests, optional live smoke test script, and usage examples in README.
   - Document deployment/usage instructions and configuration matrix.
5. **Polish** (backlog)
   - Optional caching of recent uploads, progress callbacks, QR code generation helper, CLI wrappers.

## 9. Open Questions / Assumptions
- tfLink authentication scheme: tokens appear static; need confirmation on issuance/expiration.
- Are there rate limits or daily quotas? None documented; assume reasonable usage and monitor errors.
- Should server support streaming large files (pipe) instead of loading into memory? Initial version can stream via Node FormData / `fs.createReadStream`.
- Need to confirm MCP client expectations for binary payloads; plan assumes local file path resolution is acceptable.

## 10. Next Steps
- Confirm TypeScript vs. plain JavaScript stack preference (default to TypeScript).
- Gather tfLink credential guidelines if authenticated mode is required for production use.
- Begin scaffolding repository per roadmap step 1.
