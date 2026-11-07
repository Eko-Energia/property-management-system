import type { EventStatus, ItemStatus, ShoppingStatus, UserRole } from '@/lib/types';

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone }> = {
  in_workshop: { label: 'W warsztacie', tone: 'neutral' },
  assigned_to_event: { label: 'Przypisany do wyjazdu', tone: 'warning' },
  packed: { label: 'Spakowany', tone: 'success' },
  missing: { label: 'Zaginiony', tone: 'danger' },
  broken: { label: 'Uszkodzony', tone: 'danger' },
};

export const EVENT_STATUS: Record<EventStatus, { label: string; tone: Tone }> = {
  planning: { label: 'Planowanie', tone: 'info' },
  active: { label: 'W trakcie', tone: 'success' },
  closed: { label: 'Zamknięty', tone: 'neutral' },
};

export const SHOPPING_STATUS: Record<ShoppingStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Do zamówienia', tone: 'warning' },
  ordered: { label: 'Zamówione', tone: 'info' },
  received: { label: 'Przyjęte', tone: 'success' },
  cancelled: { label: 'Anulowane', tone: 'neutral' },
};

export const ROLE_LABEL: Record<UserRole, string> = {
  guest: 'Gość',
  member: 'Członek',
  admin: 'Administrator',
};

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
export const formatPln = (value: number | null | undefined) => (value == null ? '—' : pln.format(value));

const dateFmt = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '—');

const rtf = new Intl.RelativeTimeFormat('pl-PL', { numeric: 'auto' });
export function formatRelative(iso: string, now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return formatDate(iso);
}

/** Polish plural: plural(5, ['przedmiot', 'przedmioty', 'przedmiotów']) -> "przedmiotów" */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Normalises user input for case/diacritics-insensitive search. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .trim();
}

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  const haystack = fields.map(normalize).join(' ');
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

/** Only allow http(s) links to be rendered as <a href>. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** "allegro.pl" from a full URL, for compact link labels. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
