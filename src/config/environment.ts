import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface TfLinkCredentials {
  userId: string;
  authToken: string;
}

export interface TfLinkConfig {
  baseUrl: string;
  maxFileSizeBytes: number;
  requestTimeoutMs: number;
  defaultCredentials?: TfLinkCredentials;
  anonymousRetentionMs: number;
}

export interface AppMetadata {
  name: string;
  version: string;
}

export interface AppConfig {
  app: AppMetadata;
  tfLink: TfLinkConfig;
}

const DEFAULT_BASE_URL = 'https://tmpfile.link';
const DEFAULT_MAX_FILE_SIZE_MB = 100;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ANON_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PACKAGE_META_FALLBACK: AppMetadata = {
  name: 'temp-file-share-mcp',
  version: '0.0.0-dev',
};

function safeNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readPackageMetadata(): AppMetadata {
  try {
    const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
    const raw = readFileSync(packagePath, 'utf-8');
    const parsed = JSON.parse(raw) as { name?: string; version?: string };
    return {
      name: parsed.name ?? PACKAGE_META_FALLBACK.name,
      version: parsed.version ?? PACKAGE_META_FALLBACK.version,
    };
  } catch (_error) {
    return PACKAGE_META_FALLBACK;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const packageMeta = readPackageMetadata();
  const maxFileSizeMb = safeNumber(env.TFLINK_MAX_FILE_SIZE_MB, DEFAULT_MAX_FILE_SIZE_MB);

  const defaultCredentials = env.TFLINK_USER_ID && env.TFLINK_AUTH_TOKEN
    ? {
        userId: env.TFLINK_USER_ID,
        authToken: env.TFLINK_AUTH_TOKEN,
      }
    : undefined;

  const tfLinkConfig: TfLinkConfig = {
    baseUrl: env.TFLINK_BASE_URL?.trim() || DEFAULT_BASE_URL,
    maxFileSizeBytes: Math.max(maxFileSizeMb, 0) * 1024 * 1024,
    requestTimeoutMs: safeNumber(env.HTTP_REQUEST_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    anonymousRetentionMs: DEFAULT_ANON_RETENTION_MS,
  };

  if (defaultCredentials) {
    tfLinkConfig.defaultCredentials = defaultCredentials;
  }

  return {
    app: {
      name: env.MCP_SERVER_NAME?.trim() || packageMeta.name,
      version:
        env.MCP_SERVER_VERSION?.trim() || env.npm_package_version?.trim() || packageMeta.version,
    },
    tfLink: tfLinkConfig,
  };
}

export type { AppConfig as Config };
