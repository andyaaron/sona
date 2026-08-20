export interface ApiClientConfig {
  baseUrl: string;
  /** Called before each request; return the current auth token or null. */
  getToken?: () => Promise<string | null> | string | null;
  /** Called when the server returns 401; each app handles this differently. */
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API error ${status}: ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

let config: ApiClientConfig | null = null;

/** Call once at app startup (admin and mobile each do this with their own baseUrl). */
export function configureApiClient(next: ApiClientConfig): void {
  config = next;
}

export async function apiFetch<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {},
): Promise<T> {
  if (!config) {
    throw new Error("API client not configured — call configureApiClient() at startup");
  }

  const token = await config.getToken?.();
  const { body, headers, ...rest } = init;

  const response = await fetch(`${config.baseUrl}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  
  if (response.status === 401) {
    config.onUnauthorized?.();
    return new Promise(() => {});
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
