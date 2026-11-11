import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { EcoEvent } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CATEGORY_META } from '@/lib/domain';
import { dateLocale, fmtTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function EventCalendar({ events }: { events: EcoEvent[] }) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const locale = dateLocale();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const byDay = (d: Date) => events.filter((e) => isSameDay(new Date(e.starts_at), d));
  const weekDays = days.slice(0, 7).map((d) => format(d, 'EEEEEE', { locale }));
  const selectedEvents = selected ? byDay(selected) : [];

  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label={t('calendar.prev')}>
          <ChevronLeft />
        </Button>
        <h2 className="text-lg font-semibold capitalize" aria-live="polite">
          {format(month, 'LLLL yyyy', { locale })}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label={t('calendar.next')}>
          <ChevronRight />
        </Button>
      </div>
      <div role="grid" aria-label={t('calendar.label')}>
        <div role="row" className="grid grid-cols-7 text-center text-xs font-medium uppercase text-muted-foreground">
          {weekDays.map((w) => (
            <div role="columnheader" key={w} className="py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const list = byDay(d);
            const inMonth = isSameMonth(d, month);
            const isSel = selected && isSameDay(d, selected);
            return (
              <button
                role="gridcell"
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                aria-selected={!!isSel}
                aria-label={`${format(d, 'd MMMM', { locale })}${list.length ? `, ${t('calendar.eventsCount', { count: list.length })}` : ''}`}
                className={cn(
                  'flex min-h-14 flex-col items-stretch rounded-md border p-1 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-20',
                  inMonth ? 'bg-card' : 'bg-muted/40 text-muted-foreground',
                  isSel && 'border-primary ring-1 ring-primary',
                )}
              >
                <span className={cn('mb-0.5 self-end rounded-full px-1.5 font-medium', isToday(d) && 'bg-primary text-primary-foreground')}>
                  {format(d, 'd')}
                </span>
                <span className="flex flex-wrap gap-0.5">
                  {list.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className="hidden truncate rounded px-1 text-[10px] text-white sm:block sm:w-full"
                      style={{ backgroundColor: CATEGORY_META[e.category].color }}
                    >
                      {e.title}
                    </span>
                  ))}
                  {list.map((e) => (
                    <span key={`dot-${e.id}`} className="h-2 w-2 rounded-full sm:hidden" style={{ backgroundColor: CATEGORY_META[e.category].color }} aria-hidden />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="mt-4 space-y-2" aria-live="polite">
          <h3 className="font-semibold">{format(selected, 'd MMMM, EEEE', { locale })}</h3>
          {selectedEvents.length === 0 && <p className="text-sm text-muted-foreground">{t('calendar.noEvents')}</p>}
          {selectedEvents.map((e) => (
            <Link key={e.id} to={`/events/${e.id}`} className="flex items-center gap-2 rounded-lg border p-2 hover:bg-accent">
              <span aria-hidden>{CATEGORY_META[e.category].emoji}</span>
              <span className="font-medium">{e.title}</span>
              <span className="ml-auto text-sm text-muted-foreground">{fmtTime(e.starts_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
