/** Коды ошибок API (совпадают с backend/app/errors.py). Переводятся в UI через t(`errors.${code}`). */
export const API_ERROR_CODES = [
  'auth_required',
  'token_expired',
  'forbidden',
  'csrf_failed',
  'invalid_credentials',
  'email_taken',
  'user_blocked',
  'not_found',
  'event_full',
  'event_closed',
  'already_registered',
  'validation',
  'upload_failed',
  'invalid_token',
  'rate_limited',
  'network',
  'unknown',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export function isApiErrorCode(v: unknown): v is ApiErrorCode {
  return typeof v === 'string' && (API_ERROR_CODES as readonly string[]).includes(v);
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = 'ApiError';
  }
}

export function errorCode(e: unknown): ApiErrorCode {
  return e instanceof ApiError ? e.code : 'unknown';
}
