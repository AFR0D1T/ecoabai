/** Настройки села и улицы. */
import type { Street, StreetInput, VillageSettings } from '@/types';
import { http } from './http';

export const getSettings = () => http.get<VillageSettings>('/settings');
export const updateSettings = (patch: Partial<VillageSettings>) => http.patch<VillageSettings>('/settings', patch);

export const listStreets = () => http.get<Street[]>('/streets');
export const createStreet = (input: StreetInput) => http.post<Street>('/streets', input);
export const updateStreet = (id: string, input: StreetInput) => http.patch<Street>(`/streets/${encodeURIComponent(id)}`, input);
export async function deleteStreet(id: string): Promise<void> {
  await http.delete<void>(`/streets/${encodeURIComponent(id)}`);
}

/** Ближайшая улица к точке (null, если дальше 600 м). */
export const findNearestStreet = (lat: number, lng: number) => http.get<string | null>('/streets/nearest', { lat, lng });
