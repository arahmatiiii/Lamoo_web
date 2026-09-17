/** Render any number (or numeric string) using Persian-Indic digits. */
export function fa(n: string | number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

/** Convert Persian-Indic digits typed by the user back to Latin digits for parsing. */
export function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function parseIntFa(s: string): number {
  return parseInt(toLatinDigits(s), 10);
}

export function expiryLabel(days: number | undefined): string {
  if (days == null) return 'ثبت نشده';
  if (days < 0) return `${fa(-days)} روز گذشته`;
  if (days === 0) return 'امروز';
  if (days === 1) return 'فردا';
  return `${fa(days)} روز`;
}

/** Local calendar date as `YYYY-MM-DD` — never UTC, so "today" matches the user's day. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Whole days from today until an ISO date. Negative once the date has passed. */
export function daysUntil(isoDate: string | undefined): number | undefined {
  if (!isoDate) return undefined;
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/**
 * The stored date in the Persian calendar the user actually reads, e.g.
 * "۱۹ شهریور". Shows the recorded date rather than implying a verdict about
 * whether the food is still good.
 */
export function formatDateFa(isoDate: string | undefined): string {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(date);
  } catch {
    return isoDate;
  }
}

/** ISO date `days` from today — used to turn a "expires in N days" input into a fixed date. */
export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

/** Ring color by urgency, shared between the ring stroke and expiry pills. */
export function expiryColor(days: number): 'urgent' | 'soon' | 'fresh' {
  if (days <= 2) return 'urgent';
  if (days <= 7) return 'soon';
  return 'fresh';
}

export const EXPIRY_HEX: Record<ReturnType<typeof expiryColor>, string> = {
  urgent: '#8c491a',
  soon: '#f6a06b',
  fresh: '#7a8a5e',
};
