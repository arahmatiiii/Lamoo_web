import { useState } from 'react';
import { Search, Users, Clock, Flame, Plus, X, Sparkles } from 'lucide-react';
import { useStore, Recipe, RecipeIngredient } from '../store/useStore';
import RecipeDetailSheet from './RecipeDetailSheet';
import ScreenHeader from './ScreenHeader';
import { suggestRecipes } from '../utils/ai';
import { fa } from '../utils/format';

const filters = ['همه', 'الان‌بیز', 'زیر ۳۰ دق', 'سالاد', 'سوپ', 'کباب'];

export default function RecipesPage() {
  const store = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = store.recipes.filter((r) => {
    const matchFilter =
      store.recipeFilter === 'همه' ||
      r.tags.includes(store.recipeFilter) ||
      r.category === store.recipeFilter;
    const matchSearch =
      !showSearch || store.recipeSearch === '' || r.name.includes(store.recipeSearch);
    return matchFilter && matchSearch;
  });

  // The recipe using the pantry's soonest-expiring ingredient gets a nudge
  // pill naming that ingredient (e.g. "لپه رو تموم کن").
  const soonestExpiring = [...store.pantryItems]
    .filter((i) => i.expiryDays != null && i.expiryDays <= 4)
    .sort((a, b) => (a.expiryDays ?? 0) - (b.expiryDays ?? 0))[0];

  return (
    <div className="flex flex-col h-full">
      <div className="screen-header">
        <div className="min-w-0">
          <div className="header-kicker">آشپزخانه تو</div>
          <div className="header-headline">دستورهای پخت</div>
        </div>
        <button className="icon-btn press" onClick={() => setShowSearch(!showSearch)}>
          <Search size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-6 mb-1 fade-in">
          <div className="relative">
            <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#a19786' }} />
            <input
              className="pill-input"
              style={{ paddingRight: 40 }}
              placeholder="جستجو در دستورهای پخت..."
              value={store.recipeSearch}
              onChange={(e) => store.setRecipeSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto" style={{ padding: '16px 24px 4px', scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => store.setRecipeFilter(f)}
            className={`chip press ${store.recipeFilter === f ? 'chip-active' : 'chip-inactive'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Recipe list */}
      <div className="scroll-content space-y-[22px]" style={{ paddingTop: 20 }}>
        {filtered.map((recipe, idx) => {
          const nudgeIngredient =
            recipe.usesSoonExpiring && soonestExpiring
              ? recipe.ingredients.find((i) => i.name.includes(soonestExpiring.name.split('(')[0].trim()))
              : undefined;
          return (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              delay={idx}
              nudgeName={nudgeIngredient?.name ?? soonestExpiring?.name}
              onClick={() => {
                store.setSelectedRecipe(recipe);
                store.setActiveModal('recipeDetail');
              }}
            />
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: 'var(--neutral-600)' }}>
            <div className="medallion mb-3" style={{ width: 64, height: 64, fontSize: 30 }}>🍽️</div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>دستور پختی یافت نشد</p>
          </div>
        )}
      </div>

      {/* FAB — add recipe */}
      <button className="fab press" onClick={() => setShowAddModal(true)}>
        <Plus size={24} strokeWidth={3} />
      </button>

      {/* Add recipe modal */}
      {showAddModal && <AddRecipeSheet onClose={() => setShowAddModal(false)} />}

      {/* Recipe detail modal */}
      {store.activeModal === 'recipeDetail' && store.selectedRecipe && (
        <RecipeDetailSheet
          recipe={store.selectedRecipe}
          onClose={() => {
            store.setActiveModal(null);
            store.setSelectedRecipe(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeCard({
  recipe,
  onClick,
  delay,
  nudgeName,
}: {
  recipe: Recipe;
  onClick: () => void;
  delay: number;
  nudgeName?: string;
}) {
  return (
    <div className="card-lg press rise" style={{ overflow: 'hidden', cursor: 'pointer', animationDelay: `${Math.min(delay, 6) * 0.05}s` }} onClick={onClick}>
      {/* Image / medallion area */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: 196, background: 'var(--surface)' }}
      >
        <div className="medallion" style={{ width: 118, height: 118, fontSize: 54 }}>{recipe.emoji}</div>

        <div className="absolute flex flex-col items-end" style={{ top: 14, left: 14, gap: 7 }}>
          {recipe.availabilityPercent === 100 ? (
            <span className="pill pill-sage">همه‌چی هست</span>
          ) : (
            <span className="pill pill-soon">{fa(recipe.availabilityPercent)}٪ موجود</span>
          )}
          {recipe.usesSoonExpiring && nudgeName && (
            <span className="pill pill-accent">{nudgeName} رو تموم کن</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '20px 22px 24px' }}>
        <div className="font-bold mb-2" style={{ fontSize: 22, color: 'var(--text)' }}>{recipe.name}</div>
        <div className="flex flex-wrap items-center" style={{ gap: 18, fontSize: 13, color: 'var(--neutral-600)' }}>
          <span className="flex items-center gap-1.5">
            <Clock size={14} strokeWidth={2.5} />
            {fa(recipe.timeMinutes)} دقیقه
          </span>
          <span className="flex items-center gap-1.5">
            <Flame size={14} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
            {fa(recipe.calories)} کالری
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={14} strokeWidth={2.5} />
            {fa(recipe.servings)} نفر
          </span>
        </div>
      </div>
    </div>
  );
}

function AddRecipeSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🍽️');
  const [category, setCategory] = useState('سایر');
  const [timeMinutes, setTimeMinutes] = useState('30');
  const [calories, setCalories] = useState('300');
  const [servings, setServings] = useState('2');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [steps, setSteps] = useState<string[]>(['']);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Recipe[] | null>(null);

  const emojis = ['🍽️', '🥗', '🍲', '🥩', '🍚', '🍝', '🍕', '🥘', '🍳', '🧆', '🍢', '🥧'];
  const categories = ['سالاد', 'سوپ', 'کباب', 'خورشت', 'پلو', 'سایر'];

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
  }[store.aiProvider];

  const handleAiSuggest = async () => {
    const query = name.trim();
    if (!query || aiLoading) return;
    if (!providerKey.trim()) {
      setAiError('برای پیشنهاد هوشمند، ابتدا کلید API را در تنظیمات وارد کنید.');
      return;
    }
    setAiError(null);
    setAiLoading(true);
    try {
      const suggestions = await suggestRecipes(
        store.aiProvider,
        providerKey.trim(),
        query,
        store.pantryItems
      );
      setAiSuggestions(suggestions);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'خطای ناشناخته. دوباره امتحان کنید.');
    } finally {
      setAiLoading(false);
    }
  };

  const applySuggestion = (r: Recipe) => {
    setName(r.name);
    if (emojis.includes(r.emoji)) setEmoji(r.emoji);
    setCategory(categories.includes(r.category) ? r.category : 'سایر');
    setTimeMinutes(String(r.timeMinutes));
    setCalories(String(r.calories));
    setServings(String(r.servings));
    setIngredients(r.ingredients.map((i) => i.name));
    setSteps(r.steps.length ? r.steps : ['']);
    setAiSuggestions(null);
  };

  const isInPantry = (ingName: string) =>
    store.pantryItems.some(
      (p) =>
        p.available &&
        (p.name.includes(ingName.trim()) || ingName.trim().includes(p.name.split('(')[0].trim()))
    );

  const handleSave = () => {
    const cleanIngredients = ingredients.map((i) => i.trim()).filter(Boolean);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    if (!name.trim() || cleanIngredients.length === 0) return;

    const recipeIngredients: RecipeIngredient[] = cleanIngredients.map((n) => ({
      name: n,
      available: isInPantry(n),
    }));
    const availableCount = recipeIngredients.filter((i) => i.available).length;

    const recipe: Recipe = {
      id: Date.now().toString(),
      name: name.trim(),
      emoji,
      calories: parseInt(calories) || 0,
      servings: parseInt(servings) || 1,
      timeMinutes: parseInt(timeMinutes) || 0,
      availabilityPercent: Math.round((availableCount / recipeIngredients.length) * 100),
      ingredients: recipeIngredients,
      steps: cleanSteps,
      tags: [category],
      category,
    };
    store.addRecipe(recipe);
    onClose();
  };

  const updateList = (
    list: string[],
    setList: (v: string[]) => void,
    idx: number,
    value: string
  ) => {
    const next = [...list];
    next[idx] = value;
    setList(next);
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>دستور پخت جدید</h2>
            <button className="sheet-close press" onClick={onClose}>
              <X size={17} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Emoji picker */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>آیکون</div>
              <div className="flex gap-2 flex-wrap">
                {emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className="press flex items-center justify-center text-xl"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 14,
                      background: emoji === e ? 'var(--accent-100)' : 'var(--card)',
                      border: emoji === e ? '2px solid var(--accent)' : '2px solid transparent',
                      boxShadow: emoji === e ? 'none' : 'var(--shadow-sm)',
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نام غذا</div>
              <div className="flex gap-2">
                <input
                  className="input-field rounded min-w-0 flex-1"
                  placeholder="مثلاً: قورمه‌سبزی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  onClick={handleAiSuggest}
                  disabled={aiLoading || !name.trim()}
                  className="press flex-shrink-0 flex items-center justify-center"
                  style={{
                    width: 46,
                    borderRadius: 14,
                    background: name.trim() ? 'var(--accent-100)' : 'var(--card)',
                    border: name.trim() ? '1px solid var(--accent)' : '1px solid transparent',
                    boxShadow: name.trim() ? 'none' : 'var(--shadow-sm)',
                  }}
                  title="پیشنهاد هوش مصنوعی"
                >
                  {aiLoading ? (
                    <span className="flex gap-1">
                      <span className="dot-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                      <span className="dot-2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                      <span className="dot-3 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    </span>
                  ) : (
                    <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                  )}
                </button>
              </div>
              <div className="text-xs mt-2" style={{ color: 'var(--neutral-500)' }}>
                ✨ نام غذا را بنویس و روی ستاره بزن تا مواد و مراحل خودکار پر شود
              </div>
              {aiError && (
                <div className="text-xs mt-2" style={{ color: 'var(--accent-700)' }}>
                  ⚠️ {aiError}
                </div>
              )}
            </div>

            {/* AI suggestions to pick from */}
            {aiSuggestions && (
              <div className="space-y-2">
                <div className="text-xs" style={{ color: 'var(--neutral-600)' }}>یکی را انتخاب کن تا فرم کامل پر شود:</div>
                {aiSuggestions.map((r) => (
                  <button
                    key={r.id}
                    className="card press w-full flex items-center gap-3 text-right"
                    style={{ padding: 12 }}
                    onClick={() => applySuggestion(r)}
                  >
                    <span className="text-2xl flex-shrink-0">{r.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{r.name}</span>
                      <span className="block text-xs mt-0.5" style={{ color: 'var(--neutral-600)' }}>
                        {fa(r.timeMinutes)} دق · {fa(r.calories)} کالری · موجودی {fa(r.availabilityPercent)}٪
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>دسته</div>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`chip press ${category === cat ? 'chip-active' : 'chip-inactive'}`}
                    style={{ padding: '6px 14px', fontSize: 12 }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>زمان (دقیقه)</div>
                <input className="input-field rounded" type="number" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} />
              </div>
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>کالری</div>
                <input className="input-field rounded" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
              </div>
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نفرات</div>
                <input className="input-field rounded" type="number" value={servings} onChange={(e) => setServings(e.target.value)} />
              </div>
            </div>

            {/* Ingredients */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>مواد لازم</div>
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="input-field rounded min-w-0 flex-1"
                      placeholder={`ماده ${idx + 1}`}
                      value={ing}
                      onChange={(e) => updateList(ingredients, setIngredients, idx, e.target.value)}
                    />
                    {ingredients.length > 1 && (
                      <button
                        className="w-10 flex-shrink-0 flex items-center justify-center"
                        style={{ color: 'var(--neutral-500)' }}
                        onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="mt-2 text-sm font-semibold press"
                style={{ color: 'var(--accent)' }}
                onClick={() => setIngredients([...ingredients, ''])}
              >
                + افزودن ماده
              </button>
            </div>

            {/* Steps */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>مراحل پخت</div>
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      className="input-field rounded min-w-0 flex-1"
                      placeholder={`مرحله ${idx + 1}`}
                      value={step}
                      onChange={(e) => updateList(steps, setSteps, idx, e.target.value)}
                    />
                    {steps.length > 1 && (
                      <button
                        className="w-10 flex-shrink-0 flex items-center justify-center"
                        style={{ color: 'var(--neutral-500)' }}
                        onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="mt-2 text-sm font-semibold press"
                style={{ color: 'var(--accent)' }}
                onClick={() => setSteps([...steps, ''])}
              >
                + افزودن مرحله
              </button>
            </div>

            <button className="btn-primary" onClick={handleSave}>
              ذخیره دستور پخت
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
