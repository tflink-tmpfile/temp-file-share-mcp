import { loadConfig } from '../../src/config';

describe('loadConfig', () => {
  it('uses defaults when env is empty', () => {
    const config = loadConfig({});

    expect(config.tfLink.baseUrl).toBe('https://tmpfile.link');
    expect(config.tfLink.maxFileSizeBytes).toBe(100 * 1024 * 1024);
  });

  it('parses custom overrides', () => {
    const config = loadConfig({
      TFLINK_BASE_URL: 'https://example.com',
      TFLINK_MAX_FILE_SIZE_MB: '50',
      HTTP_REQUEST_TIMEOUT_MS: '1000',
      TFLINK_USER_ID: 'user',
      TFLINK_AUTH_TOKEN: 'token',
      MCP_SERVER_NAME: 'custom-server',
      MCP_SERVER_VERSION: '1.2.3',
    });

    expect(config.tfLink.baseUrl).toBe('https://example.com');
    expect(config.tfLink.maxFileSizeBytes).toBe(50 * 1024 * 1024);
    expect(config.tfLink.requestTimeoutMs).toBe(1000);
    expect(config.tfLink.defaultCredentials).toEqual({ userId: 'user', authToken: 'token' });
    expect(config.app.name).toBe('custom-server');
    expect(config.app.version).toBe('1.2.3');
  });
});
