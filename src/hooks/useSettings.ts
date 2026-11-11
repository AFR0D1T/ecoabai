import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '@/api/settings';
import type { Street, StreetInput, VillageSettings } from '@/types';
import { queryKeys } from './queryClient';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.getSettings, staleTime: 10 * 60_000 });
}

export function useStreets() {
  return useQuery({ queryKey: queryKeys.streets, queryFn: settingsApi.listStreets, staleTime: 10 * 60_000 });
}

/** Быстрый доступ к улице по id. */
export function useStreetLookup(): (id: string | null | undefined) => Street | undefined {
  const { data } = useStreets();
  return (id) => (id ? data?.find((s) => s.id === id) : undefined);
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<VillageSettings>) => settingsApi.updateSettings(patch),
    meta: { successMessage: 'admin.settings.saved' },
    onSuccess: (s) => {
      qc.setQueryData(queryKeys.settings, s);
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

function useInvalidateStreets() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.streets });
    void qc.invalidateQueries({ queryKey: queryKeys.streetRanking });
  };
}

export function useCreateStreet() {
  const inv = useInvalidateStreets();
  return useMutation({
    mutationFn: (input: StreetInput) => settingsApi.createStreet(input),
    meta: { successMessage: 'admin.settings.streetSaved' },
    onSuccess: inv,
  });
}

export function useUpdateStreet() {
  const inv = useInvalidateStreets();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StreetInput }) => settingsApi.updateStreet(id, input),
    meta: { successMessage: 'admin.settings.streetSaved' },
    onSuccess: inv,
  });
}

export function useDeleteStreet() {
  const inv = useInvalidateStreets();
  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteStreet(id),
    meta: { successMessage: 'admin.settings.streetDeleted' },
    onSuccess: inv,
  });
}

export function useNearestStreet() {
  return useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) => settingsApi.findNearestStreet(lat, lng),
  });
}
