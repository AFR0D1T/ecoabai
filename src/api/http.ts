/**
 * HTTP-клиент к бэкенду (FastAPI).
 *
 * Токены живут только в httpOnly-cookie — JS их не видит и не хранит.
 * CSRF-токен приходит в теле /auth/session и /auth/login и держится в памяти (не в localStorage);
 * отправляется заголовком X-CSRF-Token в изменяющих запросах.
 * Истёк access-токен → один общий вызов /auth/refresh и повтор запроса.
 */
import { API_BASE_URL } from '@/config';
import { ApiError, isApiErrorCode } from './errors';

let csrfToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Query;
  body?: unknown;
  form?: FormData;
  /** не пытаться обновить сессию при 401 */
  noRefresh?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
      else url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let code: unknown = 'unknown';
  try {
    code = ((await res.json()) as { code?: unknown }).code;
  } catch {
    /* тело не JSON */
  }
  return new ApiError(isApiErrorCode(code) ? code : 'unknown', `HTTP ${res.status}`);
}

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          setCsrfToken(null);
          return false;
        }
        const data = (await res.json()) as { csrf_token: string | null };
        setCsrfToken(data.csrf_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body, credentials: 'include' });
  } catch {
    throw new ApiError('network');
  }

  if (res.status === 401 && !opts.noRefresh) {
    const err = await parseError(res.clone());
    if (err.code === 'token_expired' && (await refreshSession())) {
      return request<T>(path, { ...opts, noRefresh: true });
    }
    if (err.code === 'token_expired') {
      // сессию продлить не удалось — повторяем как гость (публичные данные всё равно доступны)
      return request<T>(path, { ...opts, noRefresh: true });
    }
    throw err;
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};
