import type { DashboardStats, StreetRankingEntry } from '@/types';
import { http } from './http';

export const getStreetRanking = () => http.get<StreetRankingEntry[]>('/stats/streets');
export const getDashboardStats = () => http.get<DashboardStats>('/stats/dashboard');
