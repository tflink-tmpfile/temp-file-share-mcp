# Repository Guidelines

## Project Structure & Module Organization
- `src/` — Node.js/TypeScript source for the MCP server (entry point `src/index.ts`, tool logic under `src/tools/`).
- `src/config/` — configuration helpers (environment parsing, defaults).
- `src/clients/` — tfLink HTTP client and related abstractions.
- `tests/` — Jest test suites mirroring `src/` layout (e.g., `tests/clients/tflink.test.ts`).
- `docs/` — design artifacts such as `plan.md` and future integration notes.
- `examples/` — sample MCP client manifests or scripts once available.

## Build, Test, and Development Commands
- `npm install` — install dependencies (run after cloning or updating lockfile).
- `npm run build` — compile TypeScript to `dist/` using `tsc`.
- `npm run start` — launch the MCP server locally (stdio mode).
- `npm run dev` — run the server with `ts-node-dev` for hot reloads.
- `npm test` — execute Jest unit tests with coverage output.

## Coding Style & Naming Conventions
- Use TypeScript with 2-space indentation and semicolons.
- Follow camelCase for variables/functions, PascalCase for classes/types, kebab-case for filenames (e.g., `upload-tool.ts`).
- Run `npm run lint` before commits; configuration extends ESLint recommended + TypeScript plugin.
- Prefer async/await; avoid promise chains unless streaming.

## Testing Guidelines
- Write Jest tests for each module; co-locate mocks under `tests/__mocks__/` when needed.
- Name test files `*.test.ts`; describe blocks with intent (e.g., `describe('tflinkClient.upload', ...)`).
- Target ≥90% critical-path coverage (client + tool layers); add integration smoke test behind `LIVE_TFLINK_TEST=1` env guard.

## Commit & Pull Request Guidelines
- Use conventional commits (`feat:`, `fix:`, `docs:`) matching existing history.
- Each PR should include summary, testing evidence, and linked issue reference when applicable.
- Screenshots or JSON output snippets are encouraged for new tool behaviors or error states.

## Security & Configuration Tips
- Never check in tfLink credentials; rely on `.env` + `.env.example` for placeholders.
- Validate file size and sanitize filenames before upload; highlight any policy changes in release notes.
