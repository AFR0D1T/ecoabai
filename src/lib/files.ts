import type { EcoEvent } from '@/types';

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Генерирует .ics (RFC 5545) для мероприятия. */
export function buildIcs(event: EcoEvent, url: string): string {
  const end = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 2 * 3600_000).toISOString();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EcoAbai//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@ecoabai`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(event.starts_at)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(`${event.description}\n${url}`)}`,
    event.address ? `LOCATION:${icsEscape(event.address)}` : '',
    `GEO:${event.lat};${event.lng}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV с BOM, чтобы Excel корректно открыл кириллицу. */
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";,\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яёәіңғүұқөһ0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
