import type { DashboardStats } from '@/types';
import { http } from './http';

export const getDashboardStats = () => http.get<DashboardStats>('/stats/dashboard');
