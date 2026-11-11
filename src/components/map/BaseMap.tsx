import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';
import { Map as MapIcon, Satellite } from 'lucide-react';
import {
  DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_MAX_ZOOM, MAP_TILES, STORAGE_KEYS, type TileSource,
} from '@/config';
import { useTheme } from '@/components/layout/ThemeProvider';
import { useSettings } from '@/hooks/useSettings';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

interface BaseMapProps {
  children?: React.ReactNode;
  className?: string;
  center?: [number, number];
  zoom?: number;
  scrollWheelZoom?: boolean;
  zoomControl?: boolean;
  dragging?: boolean;
  ariaLabel: string;
}

/** Карта села (схема CARTO или спутник Esri), центрированная по настройкам. */
export function BaseMap({
  children,
  className,
  center,
  zoom,
  scrollWheelZoom = true,
  zoomControl = true,
  dragging = true,
  ariaLabel,
}: BaseMapProps) {
  const { data: settings, isLoading } = useSettings();
  if (isLoading && !center) return <Skeleton className={cn('h-full w-full rounded-none', className)} />;
  const c: LatLngExpression = center ?? [
    settings?.center_lat ?? DEFAULT_MAP_CENTER.lat,
    settings?.center_lng ?? DEFAULT_MAP_CENTER.lng,
  ];
  return (
    <div className={cn('relative h-full w-full', className)} role="region" aria-label={ariaLabel}>
      <MapContainer
        center={c}
        zoom={zoom ?? settings?.default_zoom ?? DEFAULT_MAP_ZOOM}
        scrollWheelZoom={scrollWheelZoom}
        zoomControl={zoomControl}
        dragging={dragging}
        className="h-full w-full"
      >
        <BaseTiles />
        <InvalidateOnResize />
        {children}
      </MapContainer>
      <MapStyleToggle />
    </div>
  );
}

// ---------- вид карты: схема / спутник (общий для всех карт, запоминается в браузере) ----------

export type MapStyle = 'scheme' | 'satellite';

function readStyle(): MapStyle {
  try {
    return localStorage.getItem(STORAGE_KEYS.mapStyle) === 'satellite' ? 'satellite' : 'scheme';
  } catch {
    return 'scheme';
  }
}

let currentStyle: MapStyle = readStyle();
const listeners = new Set<() => void>();

function setMapStyle(s: MapStyle) {
  currentStyle = s;
  try {
    localStorage.setItem(STORAGE_KEYS.mapStyle, s);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useMapStyle(): [MapStyle, (s: MapStyle) => void] {
  const style = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentStyle,
  );
  return [style, setMapStyle];
}

function Tiles({ source, zIndex, className }: { source: TileSource; zIndex?: number; className?: string }) {
  return (
    <TileLayer
      key={`${source.url}|${className ?? ''}`}
      url={source.url}
      attribution={source.attribution}
      maxNativeZoom={source.maxNativeZoom}
      className={className}
      maxZoom={MAP_MAX_ZOOM}
      zIndex={zIndex}
      detectRetina={false}
    />
  );
}

function BaseTiles() {
  const [style] = useMapStyle();
  const { resolved } = useTheme();
  const map = useMap();
  useEffect(() => {
    map.setMaxZoom(MAP_MAX_ZOOM);
    // убираем префикс «Leaflet» с флажком; подпись источника карты (OSM/Esri) обязательна по лицензии
    map.attributionControl.setPrefix(false);
  }, [map]);
  if (style === 'satellite') {
    return (
      <>
        <Tiles source={MAP_TILES.satellite} zIndex={1} />
        <Tiles source={MAP_TILES.satelliteRoads} zIndex={2} />
        <Tiles source={MAP_TILES.satellitePlaces} zIndex={3} />
      </>
    );
  }
  // в тёмной теме схема OSM затемняется CSS-фильтром
  return <Tiles source={MAP_TILES.scheme} zIndex={1} className={resolved === 'dark' ? 'eco-tiles-dark' : undefined} />;
}

function MapStyleToggle() {
  const { t } = useTranslation();
  const [style, setStyle] = useMapStyle();
  const items: { value: MapStyle; label: string; icon: typeof MapIcon }[] = [
    { value: 'scheme', label: t('map.styleScheme'), icon: MapIcon },
    { value: 'satellite', label: t('map.styleSatellite'), icon: Satellite },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t('map.styleLabel')}
      className="absolute left-2.5 top-[84px] z-[450] flex flex-col overflow-hidden rounded-lg border bg-card text-xs font-medium shadow-md"
    >
      {items.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={style === value}
          onClick={() => setStyle(value)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            style === value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

/** Пересчитывает размер карты при изменении контейнера (панели, вкладки). */
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function MapClickHandler({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

export function FlyTo({ position, zoom }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom ?? Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, position, zoom]);
  return null;
}

/** Даёт доступ к экземпляру карты (например, для «Сохранить текущий вид»). */
export function MapRef({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map, onReady]);
  return null;
}
