/** Обращения о проблемах. */
import type { Report, ReportDetails, ReportFilters, ReportInput, ReportStatus, ReportStatusChange } from '@/types';
import { http } from './http';

const id = (v: string) => encodeURIComponent(v);

export function listReports(f: ReportFilters = {}): Promise<Report[]> {
  return http.get<Report[]>('/reports', {
    status: f.statuses,
    type: f.type ?? 'all',
    severity: f.severity === undefined ? 'all' : String(f.severity),
    from: f.from ?? undefined,
    to: f.to ?? undefined,
    sort: f.sort ?? 'date_desc',
  });
}

export const listMyReports = () => http.get<(Report & { history: ReportStatusChange[] })[]>('/me/reports');
export const getReport = (reportId: string) => http.get<ReportDetails>(`/reports/${id(reportId)}`);
export const createReport = (input: ReportInput) => http.post<Report>('/reports', input);
export const setReportStatus = (reportId: string, status: ReportStatus, comment: string | null) =>
  http.post<Report>(`/reports/${id(reportId)}/status`, { status, comment });
export const setResolvedPhoto = (reportId: string, url: string | null) =>
  http.put<Report>(`/reports/${id(reportId)}/resolved-photo`, { url });
export const countNewReports = () => http.get<number>('/reports/new-count');
