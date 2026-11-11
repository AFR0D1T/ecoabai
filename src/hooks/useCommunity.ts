/** Значки, рейтинг, уведомления, профили. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as badgesApi from '@/api/badges';
import * as profilesApi from '@/api/profiles';
import * as notificationsApi from '@/api/notifications';
import * as statsApi from '@/api/stats';
import type { LeaderboardPeriod, ProfileFilters, Role } from '@/types';
import { queryKeys } from './queryClient';
import { useSession } from './useAuth';

export function useMyBadges() {
  const { user } = useSession();
  return useQuery({ queryKey: [...queryKeys.myBadges, user?.id], queryFn: badgesApi.getMyBadges, enabled: !!user });
}

export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({ queryKey: queryKeys.leaderboard(period), queryFn: () => profilesApi.getLeaderboard(period) });
}

export function useUserRank(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.rank(userId ?? ''),
    queryFn: () => profilesApi.getUserRank(userId as string),
    enabled: !!userId,
  });
}

export function useDashboardStats() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: statsApi.getDashboardStats });
}

export function useNotifications() {
  const { user } = useSession();
  return useQuery({
    queryKey: [...queryKeys.notifications, user?.id ?? null],
    queryFn: notificationsApi.listNotifications,
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markNotificationRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useProfiles(filters: ProfileFilters) {
  return useQuery({ queryKey: queryKeys.profiles(filters), queryFn: () => profilesApi.listProfiles(filters) });
}

export function useSetUserBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) => profilesApi.setUserBlocked(id, blocked),
    meta: { successMessage: 'admin.users.saved' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.profilesAll }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => profilesApi.setUserRole(id, role),
    meta: { successMessage: 'admin.users.saved' },
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.profilesAll }),
  });
}
