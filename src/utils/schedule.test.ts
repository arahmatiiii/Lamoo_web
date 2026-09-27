import { describe, expect, it } from 'vitest';
import { nextOccurrence, parseClockFa, WEEKDAYS_FA } from './schedule';

/** 2026-09-27 is a Sunday, 10:00 local. */
const SUNDAY_10AM = new Date(2026, 8, 27, 10, 0, 0, 0);

describe('parseClockFa', () => {
  it('reads Persian digits', () => {
    expect(parseClockFa('۱۸:۳۰')).toBe(18 * 60 + 30);
  });

  it('reads Latin digits and a single-digit hour', () => {
    expect(parseClockFa('7:05')).toBe(7 * 60 + 5);
  });

  it('rejects an impossible clock', () => {
    expect(parseClockFa('25:00')).toBeUndefined();
    expect(parseClockFa('12:75')).toBeUndefined();
    expect(parseClockFa('noon')).toBeUndefined();
    expect(parseClockFa('')).toBeUndefined();
  });
});

describe('nextOccurrence', () => {
  it('uses today when the time is still ahead', () => {
    const at = nextOccurrence('یکشنبه', '۱۹:۰۰', SUNDAY_10AM);
    expect(new Date(at as number)).toEqual(new Date(2026, 8, 27, 19, 0, 0, 0));
  });

  it('skips to next week when today’s time has passed', () => {
    const at = nextOccurrence('یکشنبه', '۹:۰۰', SUNDAY_10AM);
    expect(new Date(at as number)).toEqual(new Date(2026, 9, 4, 9, 0, 0, 0));
  });

  it('finds a later day this week', () => {
    const at = nextOccurrence('سه‌شنبه', '۸:۰۰', SUNDAY_10AM);
    expect(new Date(at as number)).toEqual(new Date(2026, 8, 29, 8, 0, 0, 0));
  });

  it('wraps round to Saturday', () => {
    const at = nextOccurrence('شنبه', '۱۰:۰۰', SUNDAY_10AM);
    expect(new Date(at as number)).toEqual(new Date(2026, 9, 3, 10, 0, 0, 0));
  });

  it('handles every weekday name the app can produce', () => {
    for (const name of WEEKDAYS_FA) {
      expect(nextOccurrence(name, '۱۲:۰۰', SUNDAY_10AM)).toBeTypeOf('number');
    }
  });

  it('accepts سه‌شنبه written without the half-space', () => {
    expect(nextOccurrence('سه شنبه', '۸:۰۰', SUNDAY_10AM)).toBe(
      nextOccurrence('سه‌شنبه', '۸:۰۰', SUNDAY_10AM)
    );
  });

  it('gives up rather than guessing on input it does not recognise', () => {
    expect(nextOccurrence('بعداً', '۸:۰۰', SUNDAY_10AM)).toBeUndefined();
    expect(nextOccurrence('شنبه', 'شب', SUNDAY_10AM)).toBeUndefined();
  });

  it('always lands in the future', () => {
    for (const name of WEEKDAYS_FA) {
      for (const time of ['۰:۰۰', '۹:۵۹', '۱۰:۰۰', '۲۳:۵۹']) {
        const at = nextOccurrence(name, time, SUNDAY_10AM) as number;
        expect(at).toBeGreaterThan(SUNDAY_10AM.getTime());
      }
    }
  });
});
