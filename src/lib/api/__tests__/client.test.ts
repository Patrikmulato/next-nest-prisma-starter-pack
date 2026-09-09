// src/lib/api/__tests__/client.test.ts
import { ApiClient, ApiError } from '@/lib/api/client';

const BASE = 'http://localhost:3001';

describe('ApiClient', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn();
    // Create a fresh client for each test with a predictable base URL
    apiClient = new ApiClient(BASE);
  });

  it('builds URL with query params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: {} }),
    });

    await apiClient.get('/data/geojson', { params: { foo: 'bar' } });

    expect(global.fetch).toHaveBeenCalledWith(`${BASE}/data/geojson?foo=bar`, expect.any(Object));
  });

  it('builds URL without trailing ? when no params provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: {} }),
    });

    await apiClient.get('/data/geojson');

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toBe(`${BASE}/data/geojson`);
    expect(calledUrl).not.toContain('?');
  });

  it('throws ApiError with correct status and message on non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: jest.fn().mockResolvedValueOnce({ message: 'Resource not found' }),
    });

    await expect(apiClient.get('/data/missing')).rejects.toBeInstanceOf(ApiError);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: jest.fn().mockResolvedValueOnce({ message: 'Resource not found' }),
    });
    await expect(apiClient.get('/data/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Resource not found',
    });
  });

  it('falls back to statusText when error response body is not valid JSON', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: jest.fn().mockRejectedValueOnce(new Error('invalid json')),
    });

    await expect(apiClient.get('/data/broken')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    });
  });

  it('sends POST with JSON-serialized body and Content-Type header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({ success: true, data: { countries: [] } }),
    });

    const body = { sideFilter: 'all' };
    await apiClient.post('/data/filter', body);

    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/data/filter`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

describe('ApiClient auth + refresh-retry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('attaches the Authorization header when a token is available', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { success: true, data: { ok: 1 } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(BASE);
    client.setAccessTokenProvider(() => 'token-123');

    const data = await client.get<{ ok: number }>('/api/thing');

    expect(data).toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { ok: 2 } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(BASE);
    let token = 'stale';
    client.setAccessTokenProvider(() => token);
    const refresher = jest.fn(async () => {
      token = 'fresh';
      return 'fresh';
    });
    client.setTokenRefresher(refresher);

    const data = await client.get<{ ok: number }>('/api/thing');

    expect(refresher).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data).toEqual({ ok: 2 });
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('does not retry when the refresh fails', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(401, { message: 'unauthorized' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(BASE);
    client.setAccessTokenProvider(() => 'stale');
    client.setTokenRefresher(async () => null);

    await expect(client.get('/api/thing')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not attempt refresh for the refresh endpoint itself', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, { message: 'invalid refresh token' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(BASE);
    const refresher = jest.fn(async () => 'fresh');
    client.setTokenRefresher(refresher);

    await expect(client.post('/api/auth/refresh')).rejects.toMatchObject({
      status: 401,
    });
    expect(refresher).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the message from the standardized backend error envelope', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(401, {
        success: false,
        error: { statusCode: 401, message: 'Invalid credentials' },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ApiClient(BASE);

    await expect(
      client.post('/api/auth/login', { email: 'a', password: 'b' })
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });
});
