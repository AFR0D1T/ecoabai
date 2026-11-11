/** Пользователи (админ) и рейтинг. */
import type { LeaderboardEntry, LeaderboardPeriod, Profile, ProfileFilters, Role } from '@/types';
import { http } from './http';

const id = (v: string) => encodeURIComponent(v);

export const listProfiles = (f: ProfileFilters = {}) =>
  http.get<Profile[]>('/admin/users', { search: f.search, street_id: f.street_id ?? 'all' });
export const setUserBlocked = (userId: string, blocked: boolean) =>
  http.put<Profile>(`/admin/users/${id(userId)}/blocked`, { blocked });
export const setUserRole = (userId: string, role: Role) => http.put<Profile>(`/admin/users/${id(userId)}/role`, { role });

export const getLeaderboard = (period: LeaderboardPeriod, limit = 50) =>
  http.get<LeaderboardEntry[]>('/leaderboard', { period, limit });
export const getUserRank = (userId: string) => http.get<{ rank: number | null; total: number }>(`/users/${id(userId)}/rank`);
