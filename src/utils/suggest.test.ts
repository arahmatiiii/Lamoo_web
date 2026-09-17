import { describe, it, expect, vi, afterEach } from 'vitest';
import { rankSuggestions, suggestionMeta } from './suggest';
import { isoDateInDays } from './format';
import type { PantryItem, Recipe } from '../store/useStore';

afterEach(() => vi.useRealTimers());

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'r1',
  name: 'غذا',
  emoji: '🍽️',
  calories: 300,
  servings: 2,
  timeMinutes: 45,
  availabilityPercent: 100,
  ingredients: [{ name: 'پیاز', available: true }],
  steps: ['بپز'],
  tags: [],
  category: 'سایر',
  ...over,
});

const pantry = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: 'p1',
  name: 'پیاز',
  category: 'سایر',
  amount: '1',
  unit: 'عدد',
  emoji: '🧅',
  available: true,
  ...over,
});

describe('rankSuggestions', () => {
  it('returns nothing when there are no recipes', () => {
    expect(rankSuggestions([], [pantry()])).toEqual([]);
  });

  it('keeps the list short rather than dumping everything', () => {
    const many = Array.from({ length: 10 }, (_, i) => recipe({ id: `r${i}` }));

    expect(rankSuggestions(many, [])).toHaveLength(3);
  });

  it('prefers what the pantry already covers', () => {
    const stocked = recipe({ id: 'stocked', availabilityPercent: 100 });
    const empty = recipe({ id: 'empty', availabilityPercent: 20 });

    const [top] = rankSuggestions([empty, stocked], []);

    expect(top.recipe.id).toBe('stocked');
  });

  it('lists what is missing', () => {
    const r = recipe({
      ingredients: [
        { name: 'پیاز', available: true },
        { name: 'زعفران', available: false },
      ],
    });

    expect(rankSuggestions([r], [])[0].missing).toEqual(['زعفران']);
  });

  describe('rescuing food about to spoil', () => {
    it('floats a recipe that uses a soon-expiring item to the top', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const wilting = pantry({ name: 'سبزی', expiryDate: isoDateInDays(1) });
      const rescue = recipe({
        id: 'rescue',
        availabilityPercent: 50,
        ingredients: [{ name: 'سبزی', available: true }],
      });
      const easier = recipe({ id: 'easier', availabilityPercent: 100 });

      const [top] = rankSuggestions([easier, rescue], [wilting]);

      expect(top.recipe.id).toBe('rescue');
      expect(top.rescues?.name).toBe('سبزی');
      expect(top.reason).toBe('سبزی رو زودتر مصرف می‌کنی');
    });

    it('ignores items that are still far from expiring', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const fresh = pantry({ name: 'سبزی', expiryDate: isoDateInDays(30) });
      const r = recipe({ ingredients: [{ name: 'سبزی', available: true }] });

      expect(rankSuggestions([r], [fresh])[0].rescues).toBeUndefined();
    });

    it('ignores items with no expiry recorded', () => {
      const r = recipe({ ingredients: [{ name: 'سبزی', available: true }] });

      expect(rankSuggestions([r], [pantry({ name: 'سبزی' })])[0].rescues).toBeUndefined();
    });

    it('ignores items already used up', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const gone = pantry({ name: 'سبزی', expiryDate: isoDateInDays(1), available: false });
      const r = recipe({ ingredients: [{ name: 'سبزی', available: true }] });

      expect(rankSuggestions([r], [gone])[0].rescues).toBeUndefined();
    });

    it('matches a parenthesised pantry name', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const shrimp = pantry({ name: 'میگو (فریز)', expiryDate: isoDateInDays(2) });
      const r = recipe({ ingredients: [{ name: 'میگو', available: true }] });

      expect(rankSuggestions([r], [shrimp])[0].rescues?.name).toBe('میگو (فریز)');
    });
  });

  describe('moods', () => {
    it('"سریع باشه" puts the quickest recipe first', () => {
      const quick = recipe({ id: 'quick', timeMinutes: 15, availabilityPercent: 60 });
      const slow = recipe({ id: 'slow', timeMinutes: 120, availabilityPercent: 100 });

      expect(rankSuggestions([slow, quick], [], 'fast')[0].recipe.id).toBe('quick');
    });

    it('"کم‌خرج" prefers the one needing fewest purchases', () => {
      const cheap = recipe({
        id: 'cheap',
        availabilityPercent: 50,
        ingredients: [
          { name: 'پیاز', available: true },
          { name: 'نمک', available: false },
        ],
      });
      const pricey = recipe({
        id: 'pricey',
        availabilityPercent: 55,
        ingredients: [
          { name: 'زعفران', available: false },
          { name: 'گوشت', available: false },
          { name: 'پسته', available: false },
          { name: 'پیاز', available: true },
        ],
      });

      expect(rankSuggestions([pricey, cheap], [], 'cheap')[0].recipe.id).toBe('cheap');
    });

    // The mood is something the cook asked for; the rescue is Lamoo's own idea.
    it('respects "سریع باشه" even over a recipe that would rescue food', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const wilting = pantry({ name: 'شیر', expiryDate: isoDateInDays(2) });
      const slowRescue = recipe({
        id: 'slow-rescue',
        timeMinutes: 90,
        availabilityPercent: 100,
        ingredients: [{ name: 'شیر', available: true }],
      });
      const quick = recipe({
        id: 'quick',
        timeMinutes: 15,
        availabilityPercent: 50,
        ingredients: [
          { name: 'تخم‌مرغ', available: true },
          { name: 'گوجه', available: false },
        ],
      });

      expect(rankSuggestions([slowRescue, quick], [wilting], 'fast')[0].recipe.id).toBe('quick');
      // …but with no mood set, rescuing wins.
      expect(rankSuggestions([slowRescue, quick], [wilting])[0].recipe.id).toBe('slow-rescue');
    });

    it('respects "کم‌خرج" over a rescue that needs a big shop', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-10T12:00:00'));

      const wilting = pantry({ name: 'شیر', expiryDate: isoDateInDays(2) });
      const pricyRescue = recipe({
        id: 'pricey-rescue',
        availabilityPercent: 25,
        ingredients: [
          { name: 'شیر', available: true },
          { name: 'زعفران', available: false },
          { name: 'پسته', available: false },
          { name: 'خامه', available: false },
        ],
      });
      const cheap = recipe({ id: 'cheap', availabilityPercent: 100 });

      expect(rankSuggestions([pricyRescue, cheap], [wilting], 'cheap')[0].recipe.id).toBe('cheap');
    });

    it('"با مواد خودم" leans hardest on availability', () => {
      const stocked = recipe({ id: 'stocked', availabilityPercent: 100, timeMinutes: 90 });
      const quick = recipe({ id: 'quick', availabilityPercent: 30, timeMinutes: 10 });

      expect(rankSuggestions([quick, stocked], [], 'pantry')[0].recipe.id).toBe('stocked');
    });
  });

  describe('reasons', () => {
    it('says everything is in stock', () => {
      expect(rankSuggestions([recipe()], [])[0].reason).toBe('همه موادش الان توی خونه‌ست');
    });

    it('calls out a quick recipe', () => {
      const r = recipe({
        timeMinutes: 15,
        availabilityPercent: 50,
        ingredients: [
          { name: 'پیاز', available: true },
          { name: 'نمک', available: false },
        ],
      });

      expect(rankSuggestions([r], [])[0].reason).toBe('زیر ۱۵ دقیقه آماده‌ست');
    });

    it('counts a single missing item', () => {
      const r = recipe({
        timeMinutes: 60,
        ingredients: [
          { name: 'پیاز', available: true },
          { name: 'نمک', available: false },
        ],
      });

      expect(rankSuggestions([r], [])[0].reason).toBe('فقط یک قلم کم داری');
    });

    it('counts several missing items', () => {
      const r = recipe({
        timeMinutes: 60,
        ingredients: [
          { name: 'نمک', available: false },
          { name: 'فلفل', available: false },
        ],
      });

      expect(rankSuggestions([r], [])[0].reason).toBe('با ۲ قلم خرید آماده‌ست');
    });
  });
});

describe('suggestionMeta', () => {
  it('reads as one scannable line', () => {
    const [s] = rankSuggestions([recipe({ timeMinutes: 20, servings: 2 })], []);

    expect(suggestionMeta(s)).toBe('۲۰ دقیقه · برای ۲ نفر · همه‌چی هست');
  });

  it('mentions a single missing item', () => {
    const r = recipe({
      timeMinutes: 20,
      ingredients: [
        { name: 'پیاز', available: true },
        { name: 'نمک', available: false },
      ],
    });

    expect(suggestionMeta(rankSuggestions([r], [])[0])).toBe('۲۰ دقیقه · برای ۲ نفر · فقط یک قلم کم داری');
  });
});
