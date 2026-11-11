/** Настройки села. */
import type { VillageSettings } from '@/types';
import { http } from './http';

export const getSettings = () => http.get<VillageSettings>('/settings');
export const updateSettings = (patch: Partial<VillageSettings>) => http.patch<VillageSettings>('/settings', patch);
