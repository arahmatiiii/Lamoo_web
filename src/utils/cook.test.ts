import { describe, it, expect } from 'vitest';
import { parseStepMinutes, formatClock } from './cook';

describe('parseStepMinutes', () => {
  it('reads Persian digits', () => {
    expect(parseStepMinutes('۲۰ دقیقه بپزید')).toBe(20);
  });

  it('reads Latin digits', () => {
    expect(parseStepMinutes('به مدت 45 دقیقه در فر بگذارید')).toBe(45);
  });

  it('converts hours to minutes', () => {
    expect(parseStepMinutes('۲ ساعت بگذارید بماند')).toBe(120);
  });

  it('takes the shorter end of a range, so nothing burns', () => {
    expect(parseStepMinutes('۳۰ تا ۴۰ دقیقه بپزید')).toBe(30);
  });

  it('finds a duration mid-sentence', () => {
    expect(parseStepMinutes('پیاز را تفت دهید و سپس ۱۰ دقیقه صبر کنید')).toBe(10);
  });

  it('returns undefined for a step with no time in it', () => {
    expect(parseStepMinutes('سبزی را خرد کنید')).toBeUndefined();
    expect(parseStepMinutes('')).toBeUndefined();
  });

  it('ignores numbers that are not durations', () => {
    expect(parseStepMinutes('۳ قاشق نمک اضافه کنید')).toBeUndefined();
  });

  it('rejects a nonsensical duration rather than starting a day-long timer', () => {
    expect(parseStepMinutes('۴۸ ساعت بماند')).toBeUndefined();
    expect(parseStepMinutes('۰ دقیقه')).toBeUndefined();
  });
});

describe('formatClock', () => {
  it('pads to mm:ss in Persian digits', () => {
    expect(formatClock(330)).toBe('۰۵:۳۰');
    expect(formatClock(59)).toBe('۰۰:۵۹');
  });

  it('counts minutes past an hour rather than wrapping', () => {
    expect(formatClock(3600)).toBe('۶۰:۰۰');
  });

  it('never shows a negative clock', () => {
    expect(formatClock(-5)).toBe('۰۰:۰۰');
  });
});
