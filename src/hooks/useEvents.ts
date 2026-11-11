import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import * as eventsApi from '@/api/events';
import type { EcoEvent, EventFilters, EventInput, EventParticipant } from '@/types';
import { queryKeys } from './queryClient';
import { useSession } from './useAuth';

export function useEvents(filters: EventFilters = {}) {
  const { user } = useSession();
  return useQuery({
    queryKey: [...queryKeys.events(filters), user?.role ?? 'guest'],
    queryFn: () => eventsApi.listEvents(filters),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.event(id ?? ''),
    queryFn: () => eventsApi.getEvent(id as string),
    enabled: !!id,
  });
}

export function useMyParticipationMap() {
  const { user } = useSession();
  return useQuery({
    queryKey: [...queryKeys.myParticipationMap, user?.id ?? null],
    queryFn: eventsApi.getMyParticipationMap,
    enabled: !!user,
  });
}

export function useMyParticipations() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.myParticipations,
    queryFn: eventsApi.getMyParticipations,
    enabled: !!user,
  });
}

type ParticipationMap = Record<string, EventParticipant['status']>;

/** Запись / отмена записи с оптимистичным обновлением. */
export function useToggleParticipation() {
  const qc = useQueryClient();
  const { user } = useSession();
  const mapKey = [...queryKeys.myParticipationMap, user?.id ?? null];

  return useMutation({
    mutationFn: ({ eventId, join }: { eventId: string; join: boolean }) =>
      join ? eventsApi.registerForEvent(eventId).then(() => undefined) : eventsApi.cancelRegistration(eventId),
    meta: { silentError: false },
    onMutate: async ({ eventId, join }) => {
      await qc.cancelQueries({ queryKey: queryKeys.myParticipationMap });
      await qc.cancelQueries({ queryKey: queryKeys.eventsAll });
      await qc.cancelQueries({ queryKey: queryKeys.event(eventId) });

      const prevMap = qc.getQueryData<ParticipationMap>(mapKey);
      const prevLists = qc.getQueriesData<EcoEvent[]>({ queryKey: queryKeys.eventsAll });
      const prevEvent = qc.getQueryData<EcoEvent>(queryKeys.event(eventId));
      const delta = join ? 1 : -1;
      const patch = (e: EcoEvent): EcoEvent =>
        e.id === eventId ? { ...e, participants_count: Math.max(0, e.participants_count + delta) } : e;

      qc.setQueryData<ParticipationMap>(mapKey, { ...(prevMap ?? {}), [eventId]: join ? 'registered' : 'cancelled' });
      qc.setQueriesData<EcoEvent[]>({ queryKey: queryKeys.eventsAll }, (old) => old?.map(patch));
      if (prevEvent) qc.setQueryData<EcoEvent>(queryKeys.event(eventId), patch(prevEvent));

      return { prevMap, prevLists, prevEvent };
    },
    onError: (_e, { eventId }, ctx) => {
      if (!ctx) return;
      qc.setQueryData(mapKey, ctx.prevMap);
      for (const [key, data] of ctx.prevLists as [QueryKey, EcoEvent[] | undefined][]) qc.setQueryData(key, data);
      if (ctx.prevEvent) qc.setQueryData(queryKeys.event(eventId), ctx.prevEvent);
    },
    onSettled: (_d, _e, { eventId }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.myParticipationMap });
      void qc.invalidateQueries({ queryKey: queryKeys.myParticipations });
      void qc.invalidateQueries({ queryKey: queryKeys.eventsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

// ---------- админ ----------

function useInvalidateEvents() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.eventsAll });
    void qc.invalidateQueries({ queryKey: ['event'] });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}

export function useCreateEvent() {
  const inv = useInvalidateEvents();
  return useMutation({
    mutationFn: (input: EventInput) => eventsApi.createEvent(input),
    meta: { successMessage: 'admin.events.saved' },
    onSuccess: inv,
  });
}

export function useUpdateEvent() {
  const inv = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<EventInput> }) => eventsApi.updateEvent(id, patch),
    meta: { successMessage: 'admin.events.saved' },
    onSuccess: inv,
  });
}

/** Перетаскивание метки — без тоста. */
export function useMoveEvent() {
  const inv = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: string; lat: number; lng: number }) => eventsApi.updateEvent(id, { lat, lng }),
    meta: { successMessage: 'admin.map.moved' },
    onSuccess: inv,
  });
}

export function useCancelEvent() {
  const inv = useInvalidateEvents();
  return useMutation({
    mutationFn: (id: string) => eventsApi.cancelEvent(id),
    meta: { successMessage: 'admin.events.cancelled' },
    onSuccess: inv,
  });
}

export function useDuplicateEvent() {
  const inv = useInvalidateEvents();
  return useMutation({
    mutationFn: (id: string) => eventsApi.duplicateEvent(id),
    meta: { successMessage: 'admin.events.duplicated' },
    onSuccess: inv,
  });
}

export function useEventParticipants(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.eventParticipants(eventId ?? ''),
    queryFn: () => eventsApi.listEventParticipants(eventId as string),
    enabled: !!eventId,
  });
}

export function useSetAttendance(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, attended }: { userId: string; attended: boolean }) =>
      eventsApi.setAttendance(eventId, userId, attended),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.eventParticipants(eventId) });
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
      void qc.invalidateQueries({ queryKey: queryKeys.profilesAll });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
      void qc.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}
