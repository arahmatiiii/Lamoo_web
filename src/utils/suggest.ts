import type { PantryItem, Recipe } from '../store/useStore';
import { daysUntil, fa } from './format';

/** What the cook is in the mood for, chosen from the chips on the home screen. */
export type Mood = 'fast' | 'pantry' | 'cheap' | 'lazy';

export const MOODS: { id: Mood; label: string }[] = [
  { id: 'fast', label: 'سریع باشه' },
  { id: 'pantry', label: 'با مواد خودم' },
  { id: 'cheap', label: 'کم‌خرج' },
  { id: 'lazy', label: 'حوصله ندارم' },
];

/** How much effort the cook has in them tonight. */
export type Energy = 'none' | 'some';

export interface LazyPrefs {
  maxMinutes: number;
  energy: Energy;
}

export const LAZY_TIME_CHOICES = [15, 30, 45];

export interface Suggestion {
  recipe: Recipe;
  /** Lamoo's one-line answer to "why this one?" */
  reason: string;
  missing: string[];
  /** Pantry item this recipe helps use up before it goes off, if any. */
  rescues?: PantryItem;
}

/** Items close enough to the edge that cooking them tonight actually matters. */
const RESCUE_WINDOW_DAYS = 4;

function firstName(name: string): string {
  return name.split('(')[0].trim();
}

function findRescued(recipe: Recipe, pantryItems: PantryItem[]): PantryItem | undefined {
  const expiring = pantryItems
    .filter((p) => p.available)
    .map((p) => ({ item: p, days: daysUntil(p.expiryDate) }))
    .filter((e) => e.days != null && e.days <= RESCUE_WINDOW_DAYS)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return expiring.find(({ item }) =>
    recipe.ingredients.some((ing) => {
      const n = ing.name.trim();
      return n.includes(firstName(item.name)) || item.name.includes(n);
    })
  )?.item;
}

/**
 * Explain the pick in Lamoo's voice. Order matters: the most compelling
 * reason wins, because a suggestion without a "why" reads like noise.
 */
function buildReason(recipe: Recipe, missingCount: number, rescues?: PantryItem, mood?: Mood): string {
  // Told us they have no energy: what they care about is how little work it
  // is, not what it uses up.
  if (mood === 'lazy' && missingCount === 0) {
    return `فقط ${fa(recipe.steps.length)} مرحله داره و همه‌چیش هست`;
  }
  // No possessive suffix: it mangles names ending in ه/و/ی and the item can be
  // any word the cook typed.
  if (rescues) return `${firstName(rescues.name)} رو زودتر مصرف می‌کنی`;
  if (missingCount === 0) return 'همه موادش الان توی خونه‌ست';
  if (recipe.timeMinutes <= 20) return `زیر ${fa(recipe.timeMinutes)} دقیقه آماده‌ست`;
  if (missingCount === 1) return 'فقط یک قلم کم داری';
  return `با ${fa(missingCount)} قلم خرید آماده‌ست`;
}

/** Fewer steps and fewer ingredients — less to do and less to wash up. */
function effortPenalty(recipe: Recipe): number {
  return recipe.steps.length * 8 + recipe.ingredients.length * 5;
}

function score(
  recipe: Recipe,
  missingCount: number,
  rescues: PantryItem | undefined,
  mood?: Mood,
  lazy?: LazyPrefs
): number {
  let s = recipe.availabilityPercent;

  // Using something up before it spoils outranks a merely well-stocked
  // recipe — but not by so much that it wins when half the ingredients are
  // missing and you couldn't cook it tonight anyway.
  if (rescues) s += 60;

  // A mood is an explicit instruction from the cook, so it outweighs anything
  // Lamoo inferred on its own — including the rescue bonus above.
  switch (mood) {
    case 'fast':
      s += recipe.timeMinutes <= 20 ? 50 : recipe.timeMinutes <= 30 ? 30 : -recipe.timeMinutes * 2;
      break;
    case 'pantry':
      s += recipe.availabilityPercent; // availability counts double
      break;
    case 'cheap':
      s -= missingCount * 40;
      break;
    case 'lazy': {
      const budget = lazy?.maxMinutes ?? 30;
      // Over the time budget is effectively disqualifying — the cook told us
      // how long they are willing to stand there.
      s += recipe.timeMinutes <= budget ? 40 : -(recipe.timeMinutes - budget) * 3;
      s -= effortPenalty(recipe);
      // "No energy at all" means anything needing a shop is out of the question.
      if (lazy?.energy === 'none') s -= missingCount * 50;
      break;
    }
  }

  return s;
}

/**
 * Rank the cook's own recipes against what is actually in the pantry.
 * Three good suggestions beat thirty irrelevant ones, so this returns a short
 * ordered list rather than everything.
 */
export function rankSuggestions(
  recipes: Recipe[],
  pantryItems: PantryItem[],
  mood?: Mood,
  limit = 3,
  lazy?: LazyPrefs
): Suggestion[] {
  return recipes
    .map((recipe) => {
      const missing = recipe.ingredients.filter((i) => !i.available).map((i) => i.name);
      const rescues = findRescued(recipe, pantryItems);
      return {
        recipe,
        missing,
        rescues,
        reason: buildReason(recipe, missing.length, rescues, mood),
        _score: score(recipe, missing.length, rescues, mood, lazy),
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...suggestion }) => suggestion);
}

/** "۲۰ دقیقه · برای ۲ نفر · فقط یک قلم کم داری" */
export function suggestionMeta(suggestion: Suggestion): string {
  const { recipe, missing } = suggestion;
  const parts = [`${fa(recipe.timeMinutes)} دقیقه`, `برای ${fa(recipe.servings)} نفر`];
  if (missing.length === 0) parts.push('همه‌چی هست');
  else if (missing.length === 1) parts.push('فقط یک قلم کم داری');
  else parts.push(`${fa(missing.length)} قلم کم داری`);
  return parts.join(' · ');
}
