import { format, formatDistanceToNow } from 'date-fns';
import { ru, kk } from 'date-fns/locale';
import { currentLang } from '@/i18n';
import type { Badge } from '@/types';

export function dateLocale() {
  return currentLang() === 'kk' ? kk : ru;
}

export function fmtDate(iso: string, pattern = 'd MMMM yyyy'): string {
  return format(new Date(iso), pattern, { locale: dateLocale() });
}

export function fmtDateTime(iso: string): string {
  return format(new Date(iso), 'd MMM yyyy, HH:mm', { locale: dateLocale() });
}

export function fmtTime(iso: string): string {
  return format(new Date(iso), 'HH:mm', { locale: dateLocale() });
}

export function fmtRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: dateLocale() });
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat(currentLang() === 'kk' ? 'kk-KZ' : 'ru-RU').format(n);
}

export function fmtPercent(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function badgeName(b: Badge): string {
  return currentLang() === 'kk' ? b.name_kk : b.name_ru;
}

export function badgeDescription(b: Badge): string {
  return currentLang() === 'kk' ? b.description_kk : b.description_ru;
}

/** Значение для <input type="datetime-local"> из ISO */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
