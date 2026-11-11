import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { errorCode } from '@/api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Ключ i18n для тоста об успехе */
      successMessage?: string;
      /** Не показывать тост об ошибке (компонент обработает сам) */
      silentError?: boolean;
    };
  }
}

export const queryKeys = {
  session: ['session'] as const,
  events: (filters: object = {}) => ['events', filters] as const,
  eventsAll: ['events'] as const,
  event: (id: string) => ['event', id] as const,
  myParticipationMap: ['myParticipationMap'] as const,
  myParticipations: ['myParticipations'] as const,
  eventParticipants: (id: string) => ['eventParticipants', id] as const,
  reports: (filters: object = {}) => ['reports', filters] as const,
  reportsAll: ['reports'] as const,
  report: (id: string) => ['report', id] as const,
  myReports: ['myReports'] as const,
  newReportsCount: ['newReportsCount'] as const,
  myBadges: ['myBadges'] as const,
  leaderboard: (period: string) => ['leaderboard', period] as const,
  rank: (userId: string) => ['rank', userId] as const,
  notifications: ['notifications'] as const,
  settings: ['settings'] as const,
  profiles: (filters: object = {}) => ['profiles', filters] as const,
  profilesAll: ['profiles'] as const,
  dashboard: ['dashboard'] as const,
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.state.data !== undefined) toast.error(i18n.t(`errors.${errorCode(error)}`));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _v, _c, mutation) => {
      if (mutation.meta?.silentError) return;
      toast.error(i18n.t(`errors.${errorCode(error)}`));
    },
    onSuccess: (_d, _v, _c, mutation) => {
      if (mutation.meta?.successMessage) toast.success(i18n.t(mutation.meta.successMessage));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => ['unknown', 'network'].includes(errorCode(err)) && count < 2,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});
