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

export function expiryLabel(days: number): string {
  if (days === 0) return 'امروز';
  if (days === 1) return 'فردا';
  return `${fa(days)} روز`;
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
