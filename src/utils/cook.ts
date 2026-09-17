import { fa, toLatinDigits } from './format';

/**
 * Pull a duration out of a cooking step so it can be offered as a timer —
 * "۲۰ دقیقه بپزید" becomes 20. Returns undefined when the step has no time in
 * it, which is most of them.
 */
export function parseStepMinutes(step: string): number | undefined {
  const text = toLatinDigits(step);

  // Ranges ("۳۰ تا ۴۰ دقیقه") should offer the shorter time — better to check
  // early than to walk away from something burning.
  const match = text.match(/(\d+)\s*(?:تا\s*\d+\s*)?(دقیقه|دقیقه‌ای|ساعت)/);
  if (!match) return undefined;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;

  const minutes = match[2] === 'ساعت' ? value * 60 : value;
  // A step claiming more than a day is a parsing accident, not a timer.
  return minutes > 24 * 60 ? undefined : minutes;
}

/** Seconds as a Persian-digit clock, e.g. ۰۵:۳۰. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${fa(String(minutes).padStart(2, '0'))}:${fa(String(seconds).padStart(2, '0'))}`;
}
