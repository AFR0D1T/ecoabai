/** Геометрические утилиты (без зависимостей от Leaflet). */

export type LatLngTuple = [number, number];

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Расстояние между точками в метрах (haversine). */
export function distanceMeters(a: LatLngTuple, b: LatLngTuple): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Расстояние от точки до отрезка в метрах (локальная равнопромежуточная проекция — достаточно для села). */
export function distanceToSegment(p: LatLngTuple, a: LatLngTuple, b: LatLngTuple): number {
  const k = Math.cos(toRad(p[0]));
  const px = p[1] * k, py = p[0];
  const ax = a[1] * k, ay = a[0];
  const bx = b[1] * k, by = b[0];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj: LatLngTuple = [ay + t * dy, (ax + t * dx) / k];
  return distanceMeters(p, proj);
}

export function distanceToPolyline(p: LatLngTuple, line: LatLngTuple[]): number {
  if (line.length === 1) return distanceMeters(p, line[0]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) best = Math.min(best, distanceToSegment(p, line[i], line[i + 1]));
  return best;
}

/** Ближайшая линия из набора: возвращает ключ и расстояние. */
export function nearestLine<K extends string>(
  p: LatLngTuple,
  lines: Record<K, LatLngTuple[]>,
): { key: K; distance: number } | null {
  let best: { key: K; distance: number } | null = null;
  for (const key of Object.keys(lines) as K[]) {
    const d = distanceToPolyline(p, lines[key]);
    if (!best || d < best.distance) best = { key, distance: d };
  }
  return best;
}
