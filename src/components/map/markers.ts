import L from 'leaflet';
import type { EventCategory, EventStatus, Report } from '@/types';
import { CATEGORY_META, isCritical, reportColor } from '@/lib/domain';

const cache = new Map<string, L.DivIcon>();

function cached(key: string, make: () => L.DivIcon): L.DivIcon {
  let icon = cache.get(key);
  if (!icon) {
    icon = make();
    cache.set(key, icon);
  }
  return icon;
}

export function eventIcon(category: EventCategory, status: EventStatus = 'published'): L.DivIcon {
  return cached(`ev:${category}:${status}`, () => {
    const { emoji, color } = CATEGORY_META[category];
    const muted = status === 'draft' || status === 'cancelled' || status === 'finished';
    const border = status === 'draft' ? 'dashed' : 'solid';
    return L.divIcon({
      className: 'eco-marker',
      iconSize: [38, 46],
      iconAnchor: [19, 44],
      popupAnchor: [0, -40],
      tooltipAnchor: [0, -40],
      html: `<div class="eco-event-pin${muted ? ' eco-muted' : ''}" style="--pin:${color};border-style:${border}"><span>${emoji}</span></div>`,
    });
  });
}

export function reportIcon(r: Pick<Report, 'severity' | 'status'>): L.DivIcon {
  const critical = isCritical(r);
  return cached(`rp:${r.severity}:${r.status}`, () => {
    const size = r.severity === 1 ? 18 : r.severity === 2 ? 24 : 30;
    return L.divIcon({
      className: 'eco-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      tooltipAnchor: [0, -size / 2],
      html: `<div class="eco-report-dot${critical ? ' eco-critical' : ''}" style="width:${size}px;height:${size}px;background:${reportColor(r)}"></div>`,
    });
  });
}

export function pointIcon(): L.DivIcon {
  return cached('point', () =>
    L.divIcon({
      className: 'eco-marker',
      iconSize: [32, 42],
      iconAnchor: [16, 40],
      html: `<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#c62828"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>`,
    }),
  );
}

export function clusterIcon(kind: 'events' | 'reports') {
  return (cluster: L.MarkerCluster) => {
    const n = cluster.getChildCount();
    return L.divIcon({
      className: 'eco-marker',
      iconSize: [40, 40],
      html: `<div class="eco-cluster eco-cluster-${kind}">${n}</div>`,
    });
  };
}
