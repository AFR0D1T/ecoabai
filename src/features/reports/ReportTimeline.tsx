import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import type { ReportStatus, ReportStatusChange } from '@/types';
import { STATUS_COLOR } from '@/lib/domain';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Таймлайн статусов: new → in_review → in_progress → resolved/rejected */
export function ReportTimeline({ status, history }: { status: ReportStatus; history: ReportStatusChange[] }) {
  const { t } = useTranslation();
  const final: ReportStatus = status === 'rejected' ? 'rejected' : 'resolved';
  const steps: ReportStatus[] = status === 'rejected' ? ['new', 'in_review', 'rejected'] : ['new', 'in_review', 'in_progress', final];
  const lastAt = (s: ReportStatus) => [...history].reverse().find((h) => h.status === s);
  const currentIdx = steps.indexOf(status);

  return (
    <ol className="flex w-full items-start" aria-label={t('report.timeline')}>
      {steps.map((s, i) => {
        const reached = i <= currentIdx;
        const entry = lastAt(s);
        const color = reached ? STATUS_COLOR[s] : undefined;
        return (
          <li key={s} className="relative flex flex-1 flex-col items-center text-center" aria-current={i === currentIdx ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn('absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2', reached ? 'bg-primary' : 'bg-muted')}
              />
            )}
            <span
              className={cn('relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-white', !reached && 'border-muted bg-card')}
              style={reached ? { backgroundColor: color, borderColor: color } : undefined}
            >
              {reached && (s === 'rejected' ? <X className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />)}
            </span>
            <span className={cn('mt-1 text-[11px] leading-tight sm:text-xs', reached ? 'font-medium' : 'text-muted-foreground')}>
              {t(`reportStatus.${s}`)}
            </span>
            {entry && <span className="hidden text-[10px] text-muted-foreground sm:block">{fmtDateTime(entry.changed_at)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Полная история статусов (для админки). */
export function ReportHistoryList({ history }: { history: ReportStatusChange[] }) {
  const { t } = useTranslation();
  return (
    <ol className="space-y-3 border-l-2 pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-card" style={{ backgroundColor: STATUS_COLOR[h.status] }} aria-hidden />
          <p className="text-sm font-medium">{t(`reportStatus.${h.status}`)}</p>
          <p className="text-xs text-muted-foreground">{fmtDateTime(h.changed_at)}</p>
          {h.comment && <p className="mt-1 text-sm">💬 {h.comment}</p>}
        </li>
      ))}
    </ol>
  );
}
