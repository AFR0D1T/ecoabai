import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsApi from '@/api/settings';
import type { VillageSettings } from '@/types';
import { queryKeys } from './queryClient';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.getSettings, staleTime: 10 * 60_000 });
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
