import { describe, it, expect, vi, afterEach } from 'vitest';
import { fa, parseIntFa, expiryLabel, toIsoDate, daysUntil, isoDateInDays } from './format';

afterEach(() => vi.useRealTimers());

/** Freeze the clock at a local noon so day maths can't drift across midnight. */
function freezeAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${iso}T12:00:00`));
}

describe('fa', () => {
  it('renders digits in Persian', () => {
    expect(fa(2100)).toBe('۲۱۰۰');
  });

  it('round-trips through parseIntFa', () => {
    expect(parseIntFa(fa(45))).toBe(45);
  });
});

describe('daysUntil', () => {
  it('counts whole days to a future date', () => {
    freezeAt('2026-03-10');
    expect(daysUntil('2026-03-13')).toBe(3);
  });

  it('is 0 for today', () => {
    freezeAt('2026-03-10');
    expect(daysUntil('2026-03-10')).toBe(0);
  });

  it('goes negative once the date has passed', () => {
    freezeAt('2026-03-10');
    expect(daysUntil('2026-03-08')).toBe(-2);
  });

  it('survives a month boundary', () => {
    freezeAt('2026-03-30');
    expect(daysUntil('2026-04-02')).toBe(3);
  });

  it('returns undefined for missing or malformed input', () => {
    expect(daysUntil(undefined)).toBeUndefined();
    expect(daysUntil('not-a-date')).toBeUndefined();
  });
});

describe('isoDateInDays', () => {
  it('anchors a countdown to a fixed date', () => {
    freezeAt('2026-03-10');
    expect(isoDateInDays(5)).toBe('2026-03-15');
  });

  it('is the inverse of daysUntil', () => {
    freezeAt('2026-03-10');
    expect(daysUntil(isoDateInDays(12))).toBe(12);
  });

  it('keeps the stored date fixed as days pass — the point of the model', () => {
    freezeAt('2026-03-10');
    const stored = isoDateInDays(3);

    freezeAt('2026-03-12');
    expect(daysUntil(stored)).toBe(1);
  });

  it('uses local calendar days, not UTC', () => {
    // Late-evening local time is already "tomorrow" in UTC; the stored date
    // must still follow the user's calendar.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T23:30:00'));
    expect(isoDateInDays(0)).toBe(toIsoDate(new Date('2026-03-10T23:30:00')));
  });
});

describe('expiryLabel', () => {
  it('names today and tomorrow', () => {
    expect(expiryLabel(0)).toBe('امروز');
    expect(expiryLabel(1)).toBe('فردا');
  });

  it('counts remaining days', () => {
    expect(expiryLabel(5)).toBe('۵ روز');
  });

  it('reports elapsed days rather than a negative count', () => {
    expect(expiryLabel(-3)).toBe('۳ روز گذشته');
  });

  it('says nothing was recorded when there is no date', () => {
    expect(expiryLabel(undefined)).toBe('ثبت نشده');
  });
});
