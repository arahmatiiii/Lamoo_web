import { describe, it, expect } from 'vitest';
import { withFreshAvailability, withFreshAvailabilityAll, ingredientInPantry } from './recipes';
import type { PantryItem, Recipe } from '../store/useStore';

const pantry = (names: string[], available = true): PantryItem[] =>
  names.map((name, i) => ({
    id: String(i),
    name,
    category: 'سایر',
    amount: '1',
    unit: 'عدد',
    emoji: '🥫',
    available,
  }));

/** Saved when the fridge was empty: everything stored as missing. */
const staleRecipe = (): Recipe => ({
  id: 'r1',
  name: 'املت',
  emoji: '🍳',
  calories: 300,
  servings: 2,
  timeMinutes: 15,
  availabilityPercent: 0,
  ingredients: [
    { name: 'تخم‌مرغ', available: false },
    { name: 'گوجه', available: false },
  ],
  steps: ['بپز'],
  tags: [],
  category: 'سایر',
});

describe('withFreshAvailability', () => {
  it('clears "کمبود" once the item is in the pantry', () => {
    const fresh = withFreshAvailability(staleRecipe(), pantry(['تخم‌مرغ']));

    expect(fresh.ingredients).toEqual([
      { name: 'تخم‌مرغ', available: true },
      { name: 'گوجه', available: false },
    ]);
  });

  it('recomputes the percentage rather than trusting the stored one', () => {
    expect(withFreshAvailability(staleRecipe(), pantry([])).availabilityPercent).toBe(0);
    expect(withFreshAvailability(staleRecipe(), pantry(['تخم‌مرغ'])).availabilityPercent).toBe(50);
    expect(
      withFreshAvailability(staleRecipe(), pantry(['تخم‌مرغ', 'گوجه'])).availabilityPercent
    ).toBe(100);
  });

  it('marks an ingredient missing again when the pantry item is used up', () => {
    const stocked = { ...staleRecipe(), availabilityPercent: 100 };
    const usedUp = pantry(['تخم‌مرغ', 'گوجه'], false);

    const fresh = withFreshAvailability(stocked, usedUp);

    expect(fresh.availabilityPercent).toBe(0);
    expect(fresh.ingredients.every((i) => !i.available)).toBe(true);
  });

  it('matches a parenthesised pantry name', () => {
    const recipe = { ...staleRecipe(), ingredients: [{ name: 'میگو', available: false }] };

    expect(withFreshAvailability(recipe, pantry(['میگو (فریز)'])).availabilityPercent).toBe(100);
  });

  it('leaves the rest of the recipe untouched', () => {
    const fresh = withFreshAvailability(staleRecipe(), pantry(['تخم‌مرغ']));

    expect(fresh).toMatchObject({ id: 'r1', name: 'املت', steps: ['بپز'], timeMinutes: 15 });
  });

  it('does not mutate the stored recipe', () => {
    const original = staleRecipe();
    withFreshAvailability(original, pantry(['تخم‌مرغ', 'گوجه']));

    expect(original.availabilityPercent).toBe(0);
    expect(original.ingredients[0].available).toBe(false);
  });

  it('reports 0% for a recipe with no ingredients rather than dividing by zero', () => {
    const empty = { ...staleRecipe(), ingredients: [] };

    expect(withFreshAvailability(empty, pantry(['تخم‌مرغ'])).availabilityPercent).toBe(0);
  });
});

describe('withFreshAvailabilityAll', () => {
  it('refreshes every recipe', () => {
    const recipes = [staleRecipe(), { ...staleRecipe(), id: 'r2' }];

    const fresh = withFreshAvailabilityAll(recipes, pantry(['تخم‌مرغ', 'گوجه']));

    expect(fresh.map((r) => r.availabilityPercent)).toEqual([100, 100]);
  });
});

describe('ingredientInPantry', () => {
  it('matches an exact name', () => {
    expect(ingredientInPantry(pantry(['پیاز']), 'پیاز')).toBe(true);
  });

  it('ignores items that are used up', () => {
    expect(ingredientInPantry(pantry(['پیاز'], false), 'پیاز')).toBe(false);
  });

  it('is false for something not in the pantry', () => {
    expect(ingredientInPantry(pantry(['پیاز']), 'زعفران')).toBe(false);
  });
});
