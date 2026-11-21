import { API_BASE_URL } from '../config';

// A plain module-level store, not React state: the fetch client needs the
// current token outside of any component, and AuthContext keeps it in sync.
let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// AuthContext registers this once, so the client can force a logout when a
// refresh fails instead of leaving the app stuck on a broken session.
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path, API_BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function rawRequest<T>(path: string, options: RequestOptions, token: string | null) {
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    details?: unknown;
    data?: T;
  };

  return { res, payload };
}

async function refreshAccessToken(): Promise<string | null> {
  const { res, payload } = await rawRequest<{ accessToken: string }>(
    '/api/v1/auth/refresh',
    { method: 'POST' },
    null,
  );
  if (!res.ok || !payload.data) return null;
  setAccessToken(payload.data.accessToken);
  return payload.data.accessToken;
}

// Every request carries the access token and, on a 401, tries exactly one
// silent refresh (the httpOnly cookie) before giving up - this is what lets
// a page reload keep the user signed in without ever handling the refresh
// token in JavaScript.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let { res, payload } = await rawRequest<T>(path, options, accessToken);

  if (res.status === 401 && path !== '/api/v1/auth/refresh') {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      ({ res, payload } = await rawRequest<T>(path, options, refreshed));
    } else {
      setAccessToken(null);
      onUnauthorized?.();
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, payload.message ?? 'Beklenmeyen bir hata oluştu', payload.details);
  }

  return payload.data as T;
}
