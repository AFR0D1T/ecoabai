import type { AppNotification } from '@/types';
import { http } from './http';

export const listNotifications = () => http.get<AppNotification[]>('/me/notifications');
export async function markNotificationRead(id: string): Promise<void> {
  await http.post<void>(`/me/notifications/${encodeURIComponent(id)}/read`);
}
export async function markAllNotificationsRead(): Promise<void> {
  await http.post<void>('/me/notifications/read-all');
}
