import type { PantryItem, Recipe } from '../store/useStore';

/** Does the pantry currently cover this ingredient? */
export function ingredientInPantry(pantryItems: PantryItem[], ingName: string): boolean {
  const n = ingName.trim();
  return pantryItems.some(
    (p) => p.available && (p.name.includes(n) || n.includes(p.name.split('(')[0].trim()))
  );
}

/**
 * Recompute what the pantry covers right now.
 *
 * Availability is derived state, not a fact about the recipe: a recipe saved
 * when the fridge was empty would otherwise claim "کمبود" forever, even after
 * the shopping was done. Always render through this rather than trusting the
 * stored `available` / `availabilityPercent`.
 */
export function withFreshAvailability(recipe: Recipe, pantryItems: PantryItem[]): Recipe {
  const ingredients = recipe.ingredients.map((ing) => ({
    ...ing,
    available: ingredientInPantry(pantryItems, ing.name),
  }));
  const availableCount = ingredients.filter((i) => i.available).length;

  return {
    ...recipe,
    ingredients,
    availabilityPercent: ingredients.length
      ? Math.round((availableCount / ingredients.length) * 100)
      : 0,
  };
}

export function withFreshAvailabilityAll(recipes: Recipe[], pantryItems: PantryItem[]): Recipe[] {
  return recipes.map((r) => withFreshAvailability(r, pantryItems));
}
