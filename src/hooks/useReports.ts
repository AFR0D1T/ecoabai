import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as reportsApi from '@/api/reports';
import { uploadPhoto } from '@/api/storage';
import type { ReportFilters, ReportInput, ReportStatus } from '@/types';
import { queryKeys } from './queryClient';
import { useSession } from './useAuth';

export function useReports(filters: ReportFilters = {}) {
  const { user } = useSession();
  return useQuery({
    queryKey: [...queryKeys.reports(filters), user?.role ?? 'guest'],
    queryFn: () => reportsApi.listReports(filters),
  });
}

export function useReport(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.report(id ?? ''),
    queryFn: () => reportsApi.getReport(id as string),
    enabled: !!id,
  });
}

export function useMyReports() {
  const { user } = useSession();
  return useQuery({ queryKey: queryKeys.myReports, queryFn: reportsApi.listMyReports, enabled: !!user });
}

export function useNewReportsCount() {
  const { isAdmin } = useSession();
  return useQuery({
    queryKey: queryKeys.newReportsCount,
    queryFn: reportsApi.countNewReports,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
}

function useInvalidateReports() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.reportsAll });
    void qc.invalidateQueries({ queryKey: ['report'] });
    void qc.invalidateQueries({ queryKey: queryKeys.myReports });
    void qc.invalidateQueries({ queryKey: queryKeys.newReportsCount });
    void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    void qc.invalidateQueries({ queryKey: queryKeys.streetRanking });
    void qc.invalidateQueries({ queryKey: queryKeys.notifications });
  };
}

export function useCreateReport() {
  const inv = useInvalidateReports();
  return useMutation({
    mutationFn: (input: ReportInput) => reportsApi.createReport(input),
    onSuccess: inv,
  });
}

export function useSetReportStatus() {
  const inv = useInvalidateReports();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, comment }: { id: string; status: ReportStatus; comment: string | null }) =>
      reportsApi.setReportStatus(id, status, comment),
    meta: { successMessage: 'admin.reports.statusSaved' },
    onSuccess: () => {
      inv();
      void qc.invalidateQueries({ queryKey: ['leaderboard'] });
      void qc.invalidateQueries({ queryKey: queryKeys.profilesAll });
    },
  });
}

export function useSetResolvedPhoto() {
  const inv = useInvalidateReports();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url: string | null }) => reportsApi.setResolvedPhoto(id, url),
    meta: { successMessage: 'admin.reports.photoSaved' },
    onSuccess: inv,
  });
}

export function useUploadPhoto() {
  return useMutation({ mutationFn: (file: File) => uploadPhoto(file) });
}
