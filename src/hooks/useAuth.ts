import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/api/auth';
import type { ProfileUpdate, SignInInput, SignUpInput } from '@/types';
import { queryKeys } from './queryClient';

export function useSession() {
  const q = useQuery({ queryKey: queryKeys.session, queryFn: authApi.getCurrentUser, staleTime: 5 * 60_000 });
  const user = q.data ?? null;
  return { user, isLoading: q.isLoading, isAdmin: user?.role === 'admin', isAuthenticated: !!user };
}

function useResetAfterAuth() {
  const qc = useQueryClient();
  return async () => {
    // Сменился пользователь — сбрасываем всё, что зависит от него
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' && q.queryKey[0] !== 'settings' });
    await qc.invalidateQueries({ queryKey: queryKeys.session });
  };
}

export function useSignIn() {
  const reset = useResetAfterAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignInInput) => authApi.signIn(input),
    meta: { silentError: true },
    onSuccess: async (user) => {
      qc.setQueryData(queryKeys.session, user);
      await reset();
    },
  });
}

export function useSignUp() {
  const reset = useResetAfterAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignUpInput) => authApi.signUp(input),
    meta: { silentError: true },
    onSuccess: async (user) => {
      qc.setQueryData(queryKeys.session, user);
      await reset();
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.signOut,
    onSuccess: () => {
      qc.setQueryData(queryKeys.session, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' && q.queryKey[0] !== 'settings' });
    },
  });
}

export function usePasswordReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
    meta: { successMessage: 'auth.resetSent' },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfileUpdate) => authApi.updateMyProfile(patch),
    meta: { successMessage: 'profile.saved' },
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.session, user);
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => authApi.confirmPasswordReset(token, password),
    meta: { silentError: true },
  });
}

/** Сообщает серверу язык интерфейса — на нём бэкенд пишет уведомления этому пользователю. */
export function useSyncLocale() {
  const { user } = useSession();
  const { i18n } = useTranslation();
  const lang = i18n.language === 'kk' ? 'kk' : 'ru';
  const userId = user?.id;
  useEffect(() => {
    if (userId) void authApi.setMyLocale(lang).catch(() => undefined);
  }, [userId, lang]);
}
