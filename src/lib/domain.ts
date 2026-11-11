import type { EventCategory, EventStatus, Report, ReportStatus, ReportType, Severity } from '@/types';

export const EVENT_CATEGORIES: EventCategory[] = ['cleanup', 'tree_planting', 'recycling', 'lecture', 'other'];
export const EVENT_STATUSES: EventStatus[] = ['draft', 'published', 'cancelled', 'finished'];
export const REPORT_TYPES: ReportType[] = ['illegal_dump', 'toxic_release', 'overflowing_bin', 'burning', 'water_pollution', 'other'];
export const REPORT_STATUSES: ReportStatus[] = ['new', 'in_review', 'in_progress', 'resolved', 'rejected'];
export const SEVERITIES: Severity[] = [1, 2, 3];
export const ACTIVE_REPORT_STATUSES: ReportStatus[] = ['new', 'in_review', 'in_progress'];

export const CATEGORY_META: Record<EventCategory, { emoji: string; color: string }> = {
  cleanup: { emoji: '🧹', color: '#2e7d32' },
  tree_planting: { emoji: '🌳', color: '#388e3c' },
  recycling: { emoji: '♻️', color: '#00897b' },
  lecture: { emoji: '🎓', color: '#3949ab' },
  other: { emoji: '🌍', color: '#6d4c41' },
};

export const REPORT_TYPE_META: Record<ReportType, { emoji: string }> = {
  illegal_dump: { emoji: '🗑️' },
  toxic_release: { emoji: '☣️' },
  overflowing_bin: { emoji: '🚮' },
  burning: { emoji: '🔥' },
  water_pollution: { emoji: '💧' },
  other: { emoji: '⚠️' },
};

/** Цвета статусов: зелёный — решено, жёлтый — новая, оранжевый — в работе, красный — критично. */
export const STATUS_COLOR: Record<ReportStatus, string> = {
  new: '#f9a825',
  in_review: '#ffb300',
  in_progress: '#ef6c00',
  resolved: '#2e7d32',
  rejected: '#9e9e9e',
};
export const CRITICAL_COLOR = '#c62828';

export const STATUS_BADGE_CLASS: Record<ReportStatus, string> = {
  new: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200',
  in_review: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  in_progress: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
  resolved: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200',
  rejected: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};

export const EVENT_STATUS_BADGE_CLASS: Record<EventStatus, string> = {
  draft: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200',
  published: 'bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
  finished: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
};

export function isCritical(r: Pick<Report, 'severity' | 'status'>): boolean {
  return r.severity === 3 && ACTIVE_REPORT_STATUSES.includes(r.status);
}

export function reportColor(r: Pick<Report, 'severity' | 'status'>): string {
  return isCritical(r) ? CRITICAL_COLOR : STATUS_COLOR[r.status];
}

export function isEventPast(e: { starts_at: string; ends_at: string | null; status: EventStatus }): boolean {
  return e.status === 'finished' || new Date(e.ends_at ?? e.starts_at).getTime() < Date.now();
}

export function isEventFull(e: { max_participants: number | null; participants_count: number }): boolean {
  return e.max_participants !== null && e.participants_count >= e.max_participants;
}
