import { describe, it, expect } from 'vitest';
import { parseRecipeSuggestions, parseScanResult, ingredientInPantry } from './ai';
import type { PantryItem } from '../store/useStore';

const pantry = (names: string[]): PantryItem[] =>
  names.map((name, i) => ({
    id: String(i),
    name,
    category: 'سایر',
    amount: '1',
    unit: 'عدد',
    emoji: '🥫',
    available: true,
  }));

const validRecipe = {
  name: 'کوکوی سبزی',
  emoji: '🥬',
  category: 'سایر',
  calories: 320,
  servings: 4,
  timeMinutes: 40,
  ingredients: ['سبزی', 'تخم‌مرغ'],
  steps: ['سبزی را خرد کن', 'با تخم‌مرغ مخلوط کن', 'سرخ کن'],
};

describe('parseRecipeSuggestions', () => {
  it('parses a well-formed recipe', () => {
    const [recipe] = parseRecipeSuggestions({ recipes: [validRecipe] }, pantry(['سبزی']));

    expect(recipe).toMatchObject({
      name: 'کوکوی سبزی',
      calories: 320,
      servings: 4,
      timeMinutes: 40,
      category: 'سایر',
    });
    expect(recipe.steps).toHaveLength(3);
  });

  it('marks which ingredients the pantry already covers', () => {
    const [recipe] = parseRecipeSuggestions({ recipes: [validRecipe] }, pantry(['سبزی']));

    expect(recipe.ingredients).toEqual([
      { name: 'سبزی', available: true },
      { name: 'تخم‌مرغ', available: false },
    ]);
    expect(recipe.availabilityPercent).toBe(50);
  });

  it('reports 100% when everything is in the pantry', () => {
    const [recipe] = parseRecipeSuggestions({ recipes: [validRecipe] }, pantry(['سبزی', 'تخم‌مرغ']));

    expect(recipe.availabilityPercent).toBe(100);
  });

  // A bad model response must not leak half-built recipes into the app.
  it.each([
    ['no name', { ...validRecipe, name: '' }],
    ['no ingredients', { ...validRecipe, ingredients: [] }],
    ['no steps', { ...validRecipe, steps: [] }],
    ['ingredients not an array', { ...validRecipe, ingredients: 'سبزی' }],
    ['not an object', 'کوکوی سبزی'],
    ['null', null],
  ])('drops a recipe with %s', (_label, bad) => {
    expect(parseRecipeSuggestions({ recipes: [bad] }, pantry([]))).toEqual([]);
  });

  it('keeps the good recipes and drops only the broken ones', () => {
    const recipes = parseRecipeSuggestions(
      { recipes: [validRecipe, { ...validRecipe, name: 'ناقص', steps: [] }] },
      pantry([])
    );

    expect(recipes.map((r) => r.name)).toEqual(['کوکوی سبزی']);
  });

  it('returns nothing for a malformed payload', () => {
    expect(parseRecipeSuggestions({}, pantry([]))).toEqual([]);
    expect(parseRecipeSuggestions(null, pantry([]))).toEqual([]);
    expect(parseRecipeSuggestions({ recipes: 'nope' }, pantry([]))).toEqual([]);
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const [recipe] = parseRecipeSuggestions(
      { recipes: [{ ...validRecipe, calories: -50, servings: 999, timeMinutes: 'زیاد' }] },
      pantry([])
    );

    expect(recipe.calories).toBe(0);
    expect(recipe.servings).toBe(20);
    expect(recipe.timeMinutes).toBe(30);
  });

  it('falls back to سایر for an unknown category', () => {
    const [recipe] = parseRecipeSuggestions(
      { recipes: [{ ...validRecipe, category: 'دسر فضایی' }] },
      pantry([])
    );

    expect(recipe.category).toBe('سایر');
  });

  it('caps the number of suggestions at six', () => {
    const many = { recipes: Array.from({ length: 12 }, () => validRecipe) };

    expect(parseRecipeSuggestions(many, pantry([]))).toHaveLength(6);
  });
});

describe('parseScanResult', () => {
  const scan = {
    name: 'شیر',
    category: 'لبنیات',
    amount: '1',
    unit: 'لیتر',
    expiryDays: 7,
    emoji: '🥛',
    confidence: 90,
  };

  it('parses a well-formed scan', () => {
    expect(parseScanResult(scan)).toEqual({
      name: 'شیر',
      category: 'لبنیات',
      amount: '1',
      unit: 'لیتر',
      expiryDays: 7,
      emoji: '🥛',
      confidence: 90,
    });
  });

  it('treats a negative expiry as "no date was readable" rather than guessing', () => {
    expect(parseScanResult({ ...scan, expiryDays: -1 }).expiryDays).toBeUndefined();
  });

  it('leaves expiry unset when the model omits it', () => {
    expect(parseScanResult({ ...scan, expiryDays: undefined }).expiryDays).toBeUndefined();
  });

  it('rejects a scan with no product name', () => {
    expect(() => parseScanResult({ ...scan, name: '   ' })).toThrow();
    expect(() => parseScanResult({})).toThrow();
  });

  it('falls back to سایر for an unknown category', () => {
    expect(parseScanResult({ ...scan, category: 'نوشیدنی فضایی' }).category).toBe('سایر');
  });

  it('clamps confidence into 0-100', () => {
    expect(parseScanResult({ ...scan, confidence: 900 }).confidence).toBe(100);
    expect(parseScanResult({ ...scan, confidence: 'زیاد' }).confidence).toBe(50);
  });
});

describe('ingredientInPantry', () => {
  it('matches an exact name', () => {
    expect(ingredientInPantry(pantry(['پیاز']), 'پیاز')).toBe(true);
  });

  it('matches a parenthesised pantry entry', () => {
    expect(ingredientInPantry(pantry(['میگو (فریز)']), 'میگو')).toBe(true);
  });

  it('ignores items that are used up', () => {
    const items = pantry(['پیاز']).map((p) => ({ ...p, available: false }));

    expect(ingredientInPantry(items, 'پیاز')).toBe(false);
  });

  it('is false for something not in the pantry', () => {
    expect(ingredientInPantry(pantry(['پیاز']), 'زعفران')).toBe(false);
  });
});
