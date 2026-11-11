import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock, MapPin } from 'lucide-react';
import type { EcoEvent, Report } from '@/types';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { ReportStatusBadge, ReportTypeLabel, SeverityBadge, CategoryBadge, EventStatusBadge } from '@/components/StatusBadges';
import { ParticipationButton } from '@/features/events/ParticipationButton';
import { EventCover, ParticipantsCount } from '@/features/events/EventCard';

export function EventPopupCard({ event, showStatus = false, footer }: { event: EcoEvent; showStatus?: boolean; footer?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="w-60 space-y-2 text-foreground">
      <EventCover event={event} className="-mx-1 h-24 w-[calc(100%+0.5rem)] rounded-md" />
      <div className="flex flex-wrap gap-1">
        <CategoryBadge category={event.category} />
        {showStatus && <EventStatusBadge status={event.status} />}
      </div>
      <Link to={`/events/${event.id}`} className="block text-base font-semibold leading-tight !text-foreground hover:underline">
        {event.title}
      </Link>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p className="m-0 inline-flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" aria-hidden /> {fmtDateTime(event.starts_at)}
        </p>
        {event.address && (
          <p className="m-0 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden /> {event.address}
          </p>
        )}
        <ParticipantsCount event={event} />
      </div>
      {footer ?? <ParticipationButton event={event} size="sm" />}
      <Link to={`/events/${event.id}`} className="block text-center text-xs font-medium !text-primary hover:underline">
        {t('events.details')}
      </Link>
    </div>
  );
}

export function ReportPopupCard({ report, footer }: { report: Report; footer?: React.ReactNode }) {
  return (
    <div className="w-60 space-y-2 text-foreground">
      {report.photo_urls[0] && (
        <img src={report.photo_urls[0]} alt="" className="h-28 w-full rounded-md object-cover" loading="lazy" />
      )}
      <ReportTypeLabel type={report.type} />
      <div className="flex flex-wrap gap-1">
        <ReportStatusBadge status={report.status} />
        <SeverityBadge report={report} />
      </div>
      <p className="m-0 text-xs text-muted-foreground">{fmtDate(report.created_at)}</p>
      <p className="m-0 line-clamp-4 text-sm">{report.description}</p>
      {report.admin_comment && (
        <p className="m-0 rounded-md bg-muted p-2 text-xs text-muted-foreground">💬 {report.admin_comment}</p>
      )}
      {footer}
    </div>
  );
}
