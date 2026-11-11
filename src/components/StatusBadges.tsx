import { useTranslation } from 'react-i18next';
import type { EventCategory, EventStatus, Report, ReportStatus } from '@/types';
import { CATEGORY_META, EVENT_STATUS_BADGE_CLASS, REPORT_TYPE_META, STATUS_BADGE_CLASS, isCritical } from '@/lib/domain';
import { cn } from '@/lib/utils';

export function ReportStatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_BADGE_CLASS[status], className)}>
      {t(`reportStatus.${status}`)}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', EVENT_STATUS_BADGE_CLASS[status])}>
      {t(`eventStatus.${status}`)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: EventCategory }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: CATEGORY_META[category].color }}
    >
      <span aria-hidden>{CATEGORY_META[category].emoji}</span> {t(`eventCategory.${category}`)}
    </span>
  );
}

export function SeverityBadge({ report }: { report: Pick<Report, 'severity' | 'status'> }) {
  const { t } = useTranslation();
  const critical = isCritical(report);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        critical ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground',
      )}
    >
      {t(`severity.${report.severity}`)}
    </span>
  );
}

export function ReportTypeLabel({ type, className }: { type: Report['type']; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-semibold', className)}>
      <span aria-hidden>{REPORT_TYPE_META[type].emoji}</span>
      {t(`reportType.${type}`)}
    </span>
  );
}
