import { toLatinDigits } from './format';

/**
 * Persian weekday names in `Date.getDay()` order, so index 0 is Sunday.
 *
 * Reminders were stored only as a weekday name and a clock time in Persian
 * digits — fine to show, impossible to schedule against. Turning that pair into
 * an absolute instant is what lets a server decide when to send a notification.
 */
export const WEEKDAYS_FA = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
] as const;

/** Tolerates the half-space variants of سه‌شنبه that different keyboards produce. */
function normaliseDay(name: string): string {
  return name.trim().replace(/[‌‏\s]/g, '');
}

const DAY_INDEX = new Map(WEEKDAYS_FA.map((name, index) => [normaliseDay(name), index]));

/** `۱۸:۳۰` or `18:30` → minutes since midnight. */
export function parseClockFa(time: string): number | undefined {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(toLatinDigits(time).trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

/**
 * The next time that weekday and clock time comes round, as epoch milliseconds.
 * Today counts when the time has not passed yet — a reminder set for 7pm this
 * evening should not wait a week.
 */
export function nextOccurrence(
  day: string,
  time: string,
  from: Date = new Date()
): number | undefined {
  const target = DAY_INDEX.get(normaliseDay(day));
  const minutes = parseClockFa(time);
  if (target === undefined || minutes === undefined) return undefined;

  const at = new Date(from);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  let ahead = (target - at.getDay() + 7) % 7;
  if (ahead === 0 && at.getTime() <= from.getTime()) ahead = 7;
  at.setDate(at.getDate() + ahead);
  return at.getTime();
}
