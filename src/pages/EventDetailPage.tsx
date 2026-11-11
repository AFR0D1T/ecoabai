import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Marker } from 'react-leaflet';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, CalendarPlus, Coins, MapPin, SearchX, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { BaseMap } from '@/components/map/BaseMap';
import { eventIcon } from '@/components/map/markers';
import { CategoryBadge, EventStatusBadge } from '@/components/StatusBadges';
import { EventCover, ParticipantsCount } from '@/features/events/EventCard';
import { ParticipationButton } from '@/features/events/ParticipationButton';
import { useEvent } from '@/hooks/useEvents';
import { buildIcs, downloadFile, slugify } from '@/lib/files';
import { fmtDateTime, fmtTime } from '@/lib/format';
import { isSameDay } from 'date-fns';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: event, isLoading, isError } = useEvent(id);

  if (isLoading) {
    return (
      <div className="container max-w-3xl space-y-4 py-4">
        <Skeleton className="aspect-[16/7] w-full rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError || !event) {
    return (
      <div className="container max-w-3xl py-8">
        <EmptyState
          icon={SearchX}
          title={t('events.notFound')}
          action={<Button asChild variant="outline"><Link to="/events">{t('events.backToList')}</Link></Button>}
        />
      </div>
    );
  }

  const url = `${window.location.origin}/events/${event.id}`;
  const share = async () => {
    const data = { title: event.title, text: `${event.title} — ${fmtDateTime(event.starts_at)}`, url };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* пользователь отменил */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('events.linkCopied'));
    } catch {
      toast.error(t('errors.unknown'));
    }
  };
  const addToCalendar = () => downloadFile(buildIcs(event, url), `${slugify(event.title) || 'event'}.ics`, 'text/calendar;charset=utf-8');

  const end = event.ends_at;
  const when = end
    ? isSameDay(new Date(event.starts_at), new Date(end))
      ? `${fmtDateTime(event.starts_at)} – ${fmtTime(end)}`
      : `${fmtDateTime(event.starts_at)} – ${fmtDateTime(end)}`
    : fmtDateTime(event.starts_at);

  return (
    <article className="container max-w-3xl py-4 md:py-8">
      <Link to="/events" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t('events.backToList')}
      </Link>
      <EventCover event={event} className="aspect-[16/7] w-full rounded-xl" />
      <div className="mt-4 flex flex-wrap gap-2">
        <CategoryBadge category={event.category} />
        {event.status !== 'published' && <EventStatusBadge status={event.status} />}
      </div>
      <h1 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">{event.title}</h1>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" aria-hidden /> {when}</li>
            {event.address && <li className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" aria-hidden /> {event.address}</li>}
            <li className="flex items-center gap-2"><ParticipantsCount event={event} className="[&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-primary" /></li>
            <li className="flex items-center gap-2"><Coins className="h-5 w-5 text-primary" aria-hidden /> {t('events.reward', { count: event.points_reward })}</li>
          </ul>
          <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
          <div className="h-56 overflow-hidden rounded-xl border">
            <BaseMap ariaLabel={t('events.mapAria')} center={[event.lat, event.lng]} zoom={16} scrollWheelZoom={false}>
              <Marker position={[event.lat, event.lng]} icon={eventIcon(event.category, event.status)} />
            </BaseMap>
          </div>
        </div>
        <Card className="h-fit space-y-2 p-4 md:sticky md:top-4">
          <ParticipationButton event={event} size="lg" />
          <Button variant="outline" className="w-full" onClick={addToCalendar}>
            <CalendarPlus /> {t('events.addToCalendar')}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void share()}>
            <Share2 /> {t('events.share')}
          </Button>
        </Card>
      </div>
    </article>
  );
}
