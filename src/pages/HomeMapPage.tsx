import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type L from 'leaflet';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, ChevronUp, Layers, Loader2, Megaphone } from 'lucide-react';
import { BaseMap } from '@/components/map/BaseMap';
import { clusterIcon, eventIcon, reportIcon } from '@/components/map/markers';
import { EventPopupCard, ReportPopupCard } from '@/features/map/MapPopups';
import { EventCard, EventCardSkeleton } from '@/features/events/EventCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Switch } from '@/components/ui/misc';
import { useAuthGate } from '@/components/layout/AuthGate';
import { useEvents } from '@/hooks/useEvents';
import { useReports } from '@/hooks/useReports';
import { useMediaQuery } from '@/hooks/useOnline';
import { STATUS_COLOR, CRITICAL_COLOR } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { EcoEvent } from '@/types';

function Legend() {
  const { t } = useTranslation();
  const items = [
    { color: STATUS_COLOR.new, label: t('reportStatus.new') },
    { color: STATUS_COLOR.in_progress, label: t('reportStatus.in_progress') },
    { color: CRITICAL_COLOR, label: t('map.critical') },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} aria-hidden /> {i.label}
        </li>
      ))}
    </ul>
  );
}

export default function HomeMapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { requireAuth } = useAuthGate();
  const canHover = useMediaQuery('(hover: hover)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [showEvents, setShowEvents] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const events = useEvents({ scope: 'upcoming' });
  const reports = useReports({});
  const markerRefs = useRef<Record<string, L.Marker | null>>({});
  const eventClusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const st = location.state as { forbidden?: boolean } | null;
    if (st?.forbidden) {
      toast.error(t('errors.forbidden'), { id: 'forbidden' });
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate, t]);

  const visibleReports = (reports.data ?? []).filter((r) => r.status !== 'resolved' && r.status !== 'rejected');
  const upcoming = events.data ?? [];

  const focusEvent = (e: EcoEvent) => {
    setSheetOpen(false);
    if (!showEvents) setShowEvents(true);
    const marker = markerRefs.current[e.id];
    const cluster = eventClusterRef.current;
    if (marker && cluster) cluster.zoomToShowLayer(marker, () => marker.openPopup());
  };

  const loading = events.isLoading || reports.isLoading;
  // чтобы попап не прятался под правой панелью / нижней шторкой
  const popupPad: [number, number] = isDesktop ? [380, 16] : [16, 140];

  const layerControls = (
    <div className="space-y-2.5">
      <Switch checked={showEvents} onCheckedChange={setShowEvents} label={`📅 ${t('map.layerEvents')}`} />
      <Switch checked={showReports} onCheckedChange={setShowReports} label={`⚠️ ${t('map.layerReports')}`} />
      <Legend />
    </div>
  );

  const upcomingList = (
    <div className="space-y-2">
      {events.isLoading && Array.from({ length: 3 }, (_, i) => <EventCardSkeleton key={i} compact />)}
      {!events.isLoading && upcoming.length === 0 && (
        <EmptyState icon={CalendarDays} title={t('events.emptyUpcoming')} className="p-4" />
      )}
      {upcoming.slice(0, 5).map((e) => (
        <button key={e.id} className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => focusEvent(e)}>
          <span className="pointer-events-none block">
            <EventCard event={e} compact />
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="absolute inset-0">
      <BaseMap ariaLabel={t('map.ariaLabel')}>
        {showReports && (
          <MarkerClusterGroup iconCreateFunction={clusterIcon('reports')} chunkedLoading maxClusterRadius={40}>
            {visibleReports.map((r) => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r)} keyboard title={t(`reportType.${r.type}`)}>
                {canHover && <Tooltip direction="top">{t(`reportType.${r.type}`)} · {t(`reportStatus.${r.status}`)}</Tooltip>}
                <Popup minWidth={240} autoPanPaddingTopLeft={[16, 16]} autoPanPaddingBottomRight={popupPad}>
                  <ReportPopupCard report={r} />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
        {showEvents && (
          <MarkerClusterGroup ref={eventClusterRef} iconCreateFunction={clusterIcon('events')} chunkedLoading maxClusterRadius={40}>
            {upcoming.map((e) => (
              <Marker
                key={e.id}
                position={[e.lat, e.lng]}
                icon={eventIcon(e.category, e.status)}
                keyboard
                title={e.title}
                ref={(m) => {
                  markerRefs.current[e.id] = m;
                }}
              >
                {canHover && <Tooltip direction="top">{e.title}</Tooltip>}
                <Popup minWidth={240} autoPanPaddingTopLeft={[16, 16]} autoPanPaddingBottomRight={popupPad}>
                  <EventPopupCard event={e} />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
      </BaseMap>

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm shadow" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('common.loading')}
        </div>
      )}

      {/* Десктоп: правая панель */}
      {isDesktop ? (
        <aside className="absolute bottom-4 right-4 top-4 z-[500] flex w-[340px] flex-col gap-3" aria-label={t('map.panel')}>
          <Card className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4" aria-hidden /> {t('map.layers')}
            </h2>
            {layerControls}
          </Card>
          <Card className="flex min-h-0 flex-1 flex-col p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('map.upcomingEvents')}</h2>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">{upcomingList}</div>
          </Card>
        </aside>
      ) : (
        <>
          {/* Мобильный: кнопка слоёв */}
          <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-full shadow-md"
              onClick={() => setLayersOpen((v) => !v)}
              aria-expanded={layersOpen}
              aria-label={t('map.layers')}
            >
              <Layers className="h-5 w-5" />
            </Button>
            {layersOpen && <Card className="w-64 p-4 shadow-lg">{layerControls}</Card>}
          </div>
          {/* Мобильный: выдвижная панель ближайших мероприятий */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 z-[600] rounded-t-2xl border-t bg-card shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-[max-height] duration-300',
              sheetOpen ? 'max-h-[60%]' : 'max-h-14',
            )}
          >
            <button
              className="flex h-14 w-full items-center justify-between px-4 font-semibold"
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
            >
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
                {t('map.upcomingEvents')} {upcoming.length > 0 && `(${upcoming.length})`}
              </span>
              <ChevronUp className={cn('h-5 w-5 transition-transform', sheetOpen && 'rotate-180')} aria-hidden />
            </button>
            {sheetOpen && <div className="max-h-[calc(60vh-3.5rem)] overflow-y-auto px-3 pb-4">{upcomingList}</div>}
          </div>
        </>
      )}

      {/* Плавающая кнопка «Сообщить о проблеме» */}
      <Button
        size="lg"
        className={cn(
          'absolute z-[700] rounded-full shadow-lg',
          isDesktop ? 'bottom-6 left-6' : 'bottom-[4.5rem] right-3',
          sheetOpen && !isDesktop && 'hidden',
        )}
        onClick={() => requireAuth(() => navigate('/report/new'))}
      >
        {isDesktop ? <Megaphone /> : <AlertTriangle />} {t('map.reportProblem')}
      </Button>
    </div>
  );
}
