import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type L from 'leaflet';
import { Layers, Pencil, Plus, Users } from 'lucide-react';
import type { EcoEvent, EventCategory } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/misc';
import { BaseMap, FlyTo, MapClickHandler } from '@/components/map/BaseMap';
import { clusterIcon, eventIcon, pointIcon, reportIcon } from '@/components/map/markers';
import { EventPopupCard, ReportPopupCard } from '@/features/map/MapPopups';
import { EventFormSheet, type EventFormInitial } from '@/features/admin/EventFormSheet';
import { useEvents, useMoveEvent } from '@/hooks/useEvents';
import { useReports } from '@/hooks/useReports';

interface CreateState {
  createAt?: { lat: number; lng: number };
  category?: EventCategory;
  title?: string;
}

export default function MapBuilderPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const events = useEvents({ scope: 'all' });
  const reports = useReports({});
  const move = useMoveEvent();

  const [showEvents, setShowEvents] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showResolved, setShowResolved] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState<EventFormInitial | null>(null);
  const [fly, setFly] = useState<[number, number] | null>(null);

  // переход из карточки обращения: «Создать субботник здесь»
  useEffect(() => {
    const st = location.state as CreateState | null;
    if (st?.createAt) {
      setForm({ lat: st.createAt.lat, lng: st.createAt.lng, category: st.category, title: st.title });
      setFly([st.createAt.lat, st.createAt.lng]);
      navigate('.', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  const visibleEvents = (events.data ?? []).filter((e) => showPast || (e.status !== 'finished' && e.status !== 'cancelled'));
  const visibleReports = (reports.data ?? []).filter((r) => showResolved || (r.status !== 'resolved' && r.status !== 'rejected'));

  const editEvent = (e: EcoEvent) => setForm({ ...e });

  return (
    <div className="relative h-[calc(100dvh-3.5rem)]">
      <BaseMap ariaLabel={t('admin.map.ariaLabel')}>
        <MapClickHandler onClick={(e) => setPending({ lat: e.latlng.lat, lng: e.latlng.lng })} />
        <FlyTo position={fly} />
        {pending && (
          <Popup position={[pending.lat, pending.lng]} eventHandlers={{ remove: () => setPending(null) }}>
            <Button
              size="sm"
              onClick={() => {
                setForm({ lat: pending.lat, lng: pending.lng });
                setPending(null);
              }}
            >
              <Plus /> {t('admin.map.createHere')}
            </Button>
          </Popup>
        )}
        {form && !form.id && <Marker position={[form.lat, form.lng]} icon={pointIcon()} />}
        {showReports && (
          <MarkerClusterGroup iconCreateFunction={clusterIcon('reports')} maxClusterRadius={40}>
            {visibleReports.map((r) => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={reportIcon(r)}>
                <Popup minWidth={240}>
                  <ReportPopupCard
                    report={r}
                    footer={
                      <div className="grid gap-1.5">
                        <Button size="sm" asChild><Link to={`/admin/reports?id=${r.id}`}>{t('admin.reports.open')}</Link></Button>
                        <Button size="sm" variant="secondary" onClick={() => setForm({ lat: r.lat, lng: r.lng, category: 'cleanup' })}>
                          {t('admin.reports.createCleanup')}
                        </Button>
                      </div>
                    }
                  />
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}
        {showEvents &&
          visibleEvents.map((e) => (
            <Marker
              key={e.id}
              position={[e.lat, e.lng]}
              icon={eventIcon(e.category, e.status)}
              draggable
              eventHandlers={{
                dragend: (ev) => {
                  const p = (ev.target as L.Marker).getLatLng();
                  move.mutate({ id: e.id, lat: p.lat, lng: p.lng });
                },
              }}
            >
              <Tooltip direction="top">{e.title} · {t(`eventStatus.${e.status}`)}</Tooltip>
              <Popup minWidth={240}>
                <EventPopupCard
                  event={e}
                  showStatus
                  footer={
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => editEvent(e)}><Pencil /> {t('common.edit')}</Button>
                      <Button size="sm" variant="outline" asChild><Link to={`/admin/events/${e.id}`}><Users /> {t('admin.events.participants')}</Link></Button>
                    </div>
                  }
                />
              </Popup>
            </Marker>
          ))}
      </BaseMap>

      <Card className="absolute right-3 top-3 z-[500] w-64 space-y-2.5 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4" aria-hidden /> {t('map.layers')}</h2>
        <Switch checked={showEvents} onCheckedChange={setShowEvents} label={`📅 ${t('map.layerEvents')}`} />
        <Switch checked={showPast} onCheckedChange={setShowPast} label={t('admin.map.showPast')} />
        <Switch checked={showReports} onCheckedChange={setShowReports} label={`⚠️ ${t('map.layerReports')}`} />
        <Switch checked={showResolved} onCheckedChange={setShowResolved} label={t('admin.map.showClosed')} />
        <p className="border-t pt-2 text-xs text-muted-foreground">{t('admin.map.hint')}</p>
      </Card>

      <EventFormSheet open={!!form} onOpenChange={(o) => !o && setForm(null)} initial={form} />
    </div>
  );
}
