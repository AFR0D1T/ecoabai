import type { Badge, BadgeProgress } from '@/types';
import { http } from './http';

export const listBadges = () => http.get<Badge[]>('/badges');
export const getMyBadges = () => http.get<BadgeProgress[]>('/me/badges');
