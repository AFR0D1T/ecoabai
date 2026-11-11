/** Авторизация: сессия в httpOnly-cookie, csrf-токен — в памяти (см. http.ts). */
import type { Profile, ProfileUpdate, SignInInput, SignUpInput } from '@/types';
import type { Lang } from '@/i18n';
import { ApiError } from './errors';
import { http, setCsrfToken } from './http';

interface SessionResponse {
  user: Profile | null;
  csrf_token: string | null;
}

function applySession(s: SessionResponse): Profile | null {
  setCsrfToken(s.csrf_token);
  return s.user;
}

export async function getCurrentUser(): Promise<Profile | null> {
  try {
    return applySession(await http.get<SessionResponse>('/auth/session'));
  } catch (e) {
    if (e instanceof ApiError && e.code === 'user_blocked') {
      await signOut().catch(() => undefined);
      return null;
    }
    throw e;
  }
}

export async function signIn(input: SignInInput): Promise<Profile> {
  const user = applySession(await http.post<SessionResponse>('/auth/login', input));
  if (!user) throw new ApiError('unknown');
  return user;
}

export async function signUp(input: SignUpInput): Promise<Profile> {
  const user = applySession(await http.post<SessionResponse>('/auth/register', input));
  if (!user) throw new ApiError('unknown');
  return user;
}

export async function signOut(): Promise<void> {
  try {
    await http.post<void>('/auth/logout');
  } finally {
    setCsrfToken(null);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  await http.post<void>('/auth/password-reset/request', { email });
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await http.post<void>('/auth/password-reset/confirm', { token, password });
}

export function updateMyProfile(patch: ProfileUpdate): Promise<Profile> {
  return http.patch<Profile>('/auth/me', patch);
}

/** Язык уведомлений, которые сервер создаёт для пользователя. */
export async function setMyLocale(locale: Lang): Promise<void> {
  await http.patch<Profile>('/auth/me', { locale });
}
