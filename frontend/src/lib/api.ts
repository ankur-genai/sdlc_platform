const DEFAULT_API_BASE_URL = 'http://localhost:8000/api';
const DEFAULT_FASTAPI_URL = 'http://localhost:8000';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
export const FASTAPI_BASE_URL = (import.meta.env.VITE_FASTAPI_BASE_URL || DEFAULT_FASTAPI_URL).replace(/\/$/, '');

function resolveOriginFromApiBase(apiBase: string): string {
  const noTrailing = apiBase.replace(/\/$/, '');
  return noTrailing.replace(/\/api$/, '');
}

export const BACKEND_ORIGIN = API_BASE_URL.startsWith('/')
  ? API_BASE_URL
  : resolveOriginFromApiBase(API_BASE_URL);
// When the base is a relative path (e.g. "/api", proxied by the Vite dev
// server) keep the WS origin relative too — the browser resolves "/ws" against
// the page origin, so it never needs direct access to the backend port (works
// through remote/forwarded ports where only :5173 is reachable).
export const WS_BASE_URL = API_BASE_URL.startsWith('/')
  ? ''
  : BACKEND_ORIGIN.replace(/^http/, 'ws');

function buildFastApiUrl(path: string): string {
  return `${FASTAPI_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildWsUrl(path: string): string {
  return `${WS_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  // Override the default request timeout (ms). Long-running AI endpoints
  // (screen generation, Refine with AI) need much more than the default.
  timeoutMs?: number;
};

// Requests must never hang indefinitely — otherwise a stalled fetch (backend
// mid-restart, dropped connection, unreachable host) leaves callers' loading
// spinners spinning forever (e.g. the Sign In button). AbortController rejects
// the fetch after the timeout so the caller can show an error instead.
const REQUEST_TIMEOUT_MS = 30000;
// AI generation/refinement calls invoke an LLM and routinely take 30–90s, so
// they get a much longer ceiling than ordinary CRUD requests.
export const AI_REQUEST_TIMEOUT_MS = 180000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('The request timed out. Please check your connection and try again.');
    }
    throw err instanceof Error ? err : new Error('Network request failed. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

let refreshRequest: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const url = buildApiUrl(path);

  const response = await fetchWithTimeout(url, {
    method: options.method || 'GET',
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }, options.timeoutMs);

  if (response.status === 401 && retry && path !== '/auth/login' && path !== '/auth/refresh') {
    if (await refreshSession()) return apiRequest<T>(path, options, false);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data: unknown = text;
  if (contentType.includes('application/json') && text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null
      ? String((data as Record<string, unknown>).detail ?? (data as Record<string, unknown>).message ?? `Request failed (${response.status})`)
      : text || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

export async function fastApiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const url = buildFastApiUrl(path);

  const response = await fetchWithTimeout(url, {
    method: options.method || 'GET',
    credentials: 'include',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }, options.timeoutMs);

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data: unknown = text;
  if (contentType.includes('application/json') && text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null
      ? String((data as Record<string, unknown>).detail ?? (data as Record<string, unknown>).message ?? `Request failed (${response.status})`)
      : text || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}

type BackendAuthPayload = { email: string; password: string; remember_me?: boolean };

export async function backendLogin<T = unknown>({ email, password, remember_me }: BackendAuthPayload): Promise<T> {
  return fastApiRequest<T>('/auth/login', { method: 'POST', body: { email, password, remember_me: remember_me ?? true } });
}

export async function backendRegister<T = unknown>({ email, password }: BackendAuthPayload): Promise<T> {
  return fastApiRequest<T>('/auth/register', {
    method: 'POST',
    body: { email, password, full_name: email.split('@')[0] || email, role: 'developer' },
  });
}

export async function backendMe<T = unknown>(): Promise<T> {
  return fastApiRequest<T>('/auth/me');
}

export async function backendLogout<T = unknown>(): Promise<T> {
  return fastApiRequest<T>('/auth/logout', { method: 'POST' });
}
