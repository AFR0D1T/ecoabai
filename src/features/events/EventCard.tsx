import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import type { EcoEvent } from '@/types';
import { Card } from '@/components/ui/card';
import { CategoryBadge, EventStatusBadge } from '@/components/StatusBadges';
import { Skeleton } from '@/components/ui/misc';
import { fmtDateTime } from '@/lib/format';
import { CATEGORY_META } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { ParticipationButton } from './ParticipationButton';

export function ParticipantsCount({ event, className }: { event: EcoEvent; className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Users className="h-4 w-4 shrink-0" aria-hidden />
      {event.max_participants !== null
        ? t('events.signedUpOf', { count: event.participants_count, max: event.max_participants })
        : t('events.signedUp', { count: event.participants_count })}
    </span>
  );
}

export function EventCover({ event, className }: { event: EcoEvent; className?: string }) {
  if (event.cover_url) return <img src={event.cover_url} alt="" className={cn('object-cover', className)} loading="lazy" />;
  return (
    <div
      aria-hidden
      className={cn('flex items-center justify-center text-4xl', className)}
      style={{ backgroundColor: CATEGORY_META[event.category].color }}
    >
      {CATEGORY_META[event.category].emoji}
    </div>
  );
}

export function EventCard({ event, compact = false, showStatus = false }: { event: EcoEvent; compact?: boolean; showStatus?: boolean }) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* на телефоне — горизонтальная карточка с миниатюрой, чтобы в экран помещалось несколько мероприятий */}
      <div className="flex flex-row">
        <Link to={`/events/${event.id}`} tabIndex={-1} aria-hidden className={cn('shrink-0', compact ? 'w-24' : 'w-24 sm:w-48')}>
          <EventCover event={event} className={cn('h-full w-full text-3xl', compact ? 'min-h-24' : 'min-h-24 sm:min-h-40')} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={event.category} />
            {showStatus && <EventStatusBadge status={event.status} />}
          </div>
          <Link to={`/events/${event.id}`} className="line-clamp-2 font-semibold leading-tight hover:underline focus-visible:underline focus-visible:outline-none">
            {event.title}
          </Link>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden /> {fmtDateTime(event.starts_at)}
            </span>
            {event.address && !compact && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{event.address}</span>
              </span>
            )}
            <ParticipantsCount event={event} />
          </div>
          {!compact && (
            <div className="mt-auto hidden pt-1 sm:block sm:max-w-xs">
              <ParticipationButton event={event} size="sm" />
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="border-t p-2 sm:hidden">
          <ParticipationButton event={event} />
        </div>
      )}
    </Card>
  );
}

export function EventCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-row">
        <Skeleton className={cn('rounded-none', compact ? 'h-24 w-24' : 'h-28 w-24 sm:h-40 sm:w-48')} />
        <div className="flex-1 space-y-2 p-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </Card>
  );
}
