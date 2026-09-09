import { config } from '@/config';

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiClient {
  private baseUrl: string;
  private accessTokenProvider: (() => string | null) | null = null;
  private tokenRefresher: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAccessTokenProvider(provider: (() => string | null) | null): void {
    this.accessTokenProvider = provider;
  }

  setTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
    this.tokenRefresher = refresher;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    // Handle both absolute URLs and relative paths
    let urlString: string;
    if (this.baseUrl.startsWith('http')) {
      // Absolute URL (production/dev backend)
      const url = new URL(path, this.baseUrl);
      urlString = url.toString();
    } else {
      // Relative path (Vercel rewrites)
      urlString = `${this.baseUrl}${path}`;
    }

    // Add query parameters if provided
    if (params) {
      const searchParams = new URLSearchParams(params);
      urlString = `${urlString}?${searchParams.toString()}`;
    }

    return urlString;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions,
    isRetry = false
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const hasBody = body !== undefined;
    const accessToken = this.accessTokenProvider?.() ?? null;

    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options?.headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    // On 401, attempt a single token refresh then retry the original request.
    if (
      res.status === 401 &&
      !isRetry &&
      this.tokenRefresher &&
      !path.endsWith('/api/auth/refresh')
    ) {
      const refreshedToken = await this.tokenRefresher().catch(() => null);
      if (refreshedToken) {
        return this.request<T>(method, path, body, options, true);
      }
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as {
        message?: unknown;
        error?: { message?: unknown };
      } | null;
      const nestedMessage =
        typeof errorBody?.error?.message === 'string' ? errorBody.error.message : undefined;
      const topMessage = typeof errorBody?.message === 'string' ? errorBody.message : undefined;
      throw new ApiError(
        res.status,
        nestedMessage ?? topMessage ?? res.statusText ?? 'Request failed'
      );
    }

    // Extract data from standardized API response format: { success, data, timestamp, path }
    const response = (await res.json()) as { success: boolean; data: T };
    return response.data;
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient(config.apiBaseUrl);
