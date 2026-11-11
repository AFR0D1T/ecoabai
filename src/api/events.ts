/** Мероприятия и участие. */
import type {
  EcoEvent,
  EventFilters,
  EventInput,
  EventParticipant,
  MyParticipation,
  ParticipantWithProfile,
} from '@/types';
import { http } from './http';

const id = (v: string) => encodeURIComponent(v);

export function listEvents(filters: EventFilters = {}): Promise<EcoEvent[]> {
  return http.get<EcoEvent[]>('/events', {
    scope: filters.scope ?? 'all',
    category: filters.category ?? 'all',
    status: filters.statuses,
  });
}

export const getEvent = (eventId: string) => http.get<EcoEvent>(`/events/${id(eventId)}`);
export const createEvent = (input: EventInput) => http.post<EcoEvent>('/events', input);
export const updateEvent = (eventId: string, patch: Partial<EventInput>) => http.patch<EcoEvent>(`/events/${id(eventId)}`, patch);
export const cancelEvent = (eventId: string) => http.post<EcoEvent>(`/events/${id(eventId)}/cancel`);
export const duplicateEvent = (eventId: string) => http.post<EcoEvent>(`/events/${id(eventId)}/duplicate`);

export const registerForEvent = (eventId: string) => http.post<EventParticipant>(`/events/${id(eventId)}/registration`);
export async function cancelRegistration(eventId: string): Promise<void> {
  await http.delete<void>(`/events/${id(eventId)}/registration`);
}

export const getMyParticipationMap = () =>
  http.get<Record<string, EventParticipant['status']>>('/me/participations/map');
export const getMyParticipations = () => http.get<MyParticipation[]>('/me/participations');

export const listEventParticipants = (eventId: string) =>
  http.get<ParticipantWithProfile[]>(`/events/${id(eventId)}/participants`);

export const setAttendance = (eventId: string, userId: string, attended: boolean) =>
  http.put<EventParticipant>(`/events/${id(eventId)}/participants/${id(userId)}/attendance`, { attended });
