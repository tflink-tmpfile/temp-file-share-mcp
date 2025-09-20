import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import axios, { AxiosError, AxiosInstance } from 'axios';
import FormData from 'form-data';
import { lookup as lookupMime } from 'mime-types';
import type { TfLinkConfig, TfLinkCredentials } from '../config';

export interface UploadRequest {
  filePath: string;
  credentials?: Partial<TfLinkCredentials>;
}

export interface TfLinkUploadResponse extends Record<string, unknown> {
  fileName: string;
  downloadLink: string;
  downloadLinkEncoded: string;
  size: number;
  type: string;
  uploadedTo: string;
}

export interface UploadResult extends TfLinkUploadResponse {
  expiresAt: string | null;
}

export type TfLinkClientOptions = TfLinkConfig;

export class TfLinkClient {
  private readonly http: AxiosInstance;
  private readonly config: TfLinkClientOptions;

  constructor(config: TfLinkClientOptions) {
    this.config = {
      ...config,
      baseUrl: trimTrailingSlash(config.baseUrl),
    };

    this.http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.requestTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        'User-Agent': 'temp-file-share-mcp/1.0',
      },
    });
  }

  async upload(request: UploadRequest): Promise<UploadResult> {
    const filePath = path.resolve(request.filePath);
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      throw new TfLinkClientError(`Path is not a file: ${filePath}`);
    }

    if (stat.size > this.config.maxFileSizeBytes) {
      throw new TfLinkClientError(
        `File size ${stat.size} bytes exceeds limit of ${this.config.maxFileSizeBytes} bytes`,
      );
    }

    const sanitizedFileName = sanitizeFileName(path.basename(filePath));
    const inferredMime = lookupMime(sanitizedFileName) || 'application/octet-stream';

    const effectiveCredentials = mergeCredentials(
      request.credentials,
      this.config.defaultCredentials,
    );

    const form = new FormData();
    form.append('file', createReadStream(filePath), {
      filename: sanitizedFileName,
      contentType: inferredMime,
      knownLength: stat.size,
    });

    try {
      const response = await this.http.post<TfLinkUploadResponse>('/api/upload', form, {
        headers: {
          ...form.getHeaders(),
          ...credentialHeaders(effectiveCredentials),
        },
      });

      const payload = response.data;
      if (!isValidUploadResponse(payload)) {
        throw new TfLinkClientError('Unexpected response from tfLink upload API');
      }

      const expiresAt = effectiveCredentials
        ? null
        : new Date(Date.now() + this.config.anonymousRetentionMs).toISOString();

      const result: UploadResult = {
        ...payload,
        expiresAt,
      };

      return result;
    } catch (error) {
      throw wrapAxiosError(error);
    }
  }
}

export function createTfLinkClient(config: TfLinkConfig): TfLinkClient {
  return new TfLinkClient(config);
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function sanitizeFileName(name: string): string {
  const normalized = name.replace(/[\r\n\t\0]/g, '').replace(/[\\/]+/g, '_');
  const asciiOnly = normalized
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126 ? '_' : char))
    .join('');
  const trimmed = asciiOnly.trim();
  return trimmed.length > 0 ? trimmed : 'file';
}

function mergeCredentials(
  provided?: Partial<TfLinkCredentials>,
  defaults?: TfLinkCredentials,
): TfLinkCredentials | undefined {
  const userId = provided?.userId ?? defaults?.userId;
  const authToken = provided?.authToken ?? defaults?.authToken;

  if (userId && authToken) {
    return { userId, authToken };
  }

  if (!userId && !authToken) {
    return undefined;
  }

  throw new TfLinkClientError('Both userId and authToken are required when providing credentials');
}

function credentialHeaders(credentials?: TfLinkCredentials): Record<string, string> {
  if (!credentials) {
    return {};
  }

  return {
    'X-User-Id': credentials.userId,
    'X-Auth-Token': credentials.authToken,
  };
}

function isValidUploadResponse(payload: unknown): payload is TfLinkUploadResponse {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.fileName === 'string' &&
    typeof candidate.downloadLink === 'string' &&
    typeof candidate.downloadLinkEncoded === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.uploadedTo === 'string'
  );
}

function wrapAxiosError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ error?: string; message?: string }>;
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.error ||
      axiosError.response?.data?.message ||
      axiosError.message ||
      'Request to tfLink failed';

    return new TfLinkClientError(
      status ? `tfLink responded with status ${status}: ${message}` : `tfLink request failed: ${message}`,
    );
  }

  return error instanceof Error ? error : new Error(String(error));
}

export class TfLinkClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TfLinkClientError';
  }
}
