import { useTranslation } from 'react-i18next';
import type { BadgeProgress } from '@/types';
import { badgeDescription, badgeName, fmtDate } from '@/lib/format';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function BadgesGrid({ items, isLoading }: { items: BadgeProgress[] | undefined; isLoading: boolean }) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36" />)}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items?.map(({ badge, earned_at, current, target }) => {
        const earned = !!earned_at;
        const pct = Math.round((current / target) * 100);
        return (
          <li
            key={badge.id}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border p-3 text-center',
              earned ? 'border-primary/40 bg-secondary' : 'bg-card',
            )}
          >
            <span className={cn('text-4xl', !earned && 'opacity-40 grayscale')} aria-hidden>
              {badge.icon}
            </span>
            <p className={cn('text-sm font-semibold', !earned && 'text-muted-foreground')}>{badgeName(badge)}</p>
            {earned ? (
              <p className="text-xs text-muted-foreground">{t('badges.earnedAt', { date: fmtDate(earned_at) })}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{badgeDescription(badge)}</p>
                {target > 1 && (
                  <div className="mt-1 w-full">
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={target}
                      aria-valuenow={current}
                      aria-label={badgeName(badge)}
                    >
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{t('badges.progress', { current, target })}</p>
                  </div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
