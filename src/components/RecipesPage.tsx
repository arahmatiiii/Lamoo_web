import { useState } from 'react';
import { Search, Users, Clock, Flame, Plus, X } from 'lucide-react';
import { useStore, Recipe, RecipeIngredient } from '../store/useStore';
import RecipeDetailSheet from './RecipeDetailSheet';

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="app-header">
        <h1 className="text-2xl font-bold text-white">دستوریخت</h1>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center"
        >
          <Search size={18} className="text-gray-300" />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 mb-3 fade-in">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="search-input pr-9"
              placeholder="جستجو در دستوریخت‌ها..."
              value={store.recipeSearch}
              onChange={(e) => store.setRecipeSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => store.setRecipeFilter(f)}
            className={`chip ${store.recipeFilter === f ? 'chip-active' : 'chip-inactive'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Recipe list */}
      <div className="scroll-content px-4 pb-8 space-y-4">
        {filtered.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={() => {
              store.setSelectedRecipe(recipe);
              store.setActiveModal('recipeDetail');
            }}
          />
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-5xl mb-3">🍽️</span>
            <p className="text-sm">دستوریختی یافت نشد</p>
          </div>
        )}
      </div>

      {/* FAB — add recipe */}
      <button className="fab" onClick={() => setShowAddModal(true)}>
        <Plus size={24} />
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

function RecipeCard({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  return (
    <div className="recipe-card" onClick={onClick}>
      {/* Image area */}
      <div
        className="relative h-40 flex items-center justify-center"
        style={{ background: '#162032' }}
      >
        <span className="text-7xl">{recipe.emoji}</span>

        {/* Badges stack in one container so they never overlap each other */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {recipe.availabilityPercent === 100 && (
            <div
              className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: '#10b981', color: '#000' }}
            >
              ۱۰۰% موجود
            </div>
          )}

          {recipe.usesSoonExpiring && (
            <div
              className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
              style={{ background: '#f59e0b', color: '#000' }}
            >
              <span>⚠️</span>
              استفاده از لپه
            </div>
          )}

          {recipe.availabilityPercent < 100 && !recipe.usesSoonExpiring && (
            <div
              className="text-xs font-bold px-2 py-1 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.9)', color: '#000' }}
            >
              {recipe.availabilityPercent}% موجود
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="text-lg font-bold text-white mb-2 leading-7">{recipe.name}</div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Users size={14} />
            نفر {recipe.servings}
          </span>
          <span className="flex items-center gap-1">
            <Flame size={14} className="text-orange-400" />
            کالری {recipe.calories}
          </span>
          {recipe.timeMinutes && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {recipe.timeMinutes} دق
            </span>
          )}
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

  const emojis = ['🍽️', '🥗', '🍲', '🥩', '🍚', '🍝', '🍕', '🥘', '🍳', '🧆', '🍢', '🥧'];
  const categories = ['سالاد', 'سوپ', 'کباب', 'خورشت', 'پلو', 'سایر'];

  // Mark an ingredient available when a pantry item name matches it (either direction)
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
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">دستور پخت جدید</h2>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Emoji picker */}
          <div>
            <div className="text-xs text-gray-400 mb-2">آیکون</div>
            <div className="flex gap-2 flex-wrap">
              {emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{
                    background: emoji === e ? 'rgba(16,185,129,0.2)' : '#1f2937',
                    border: emoji === e ? '2px solid #10b981' : '2px solid transparent',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">نام غذا</div>
            <input
              className="input-field"
              placeholder="مثلاً: قورمه‌سبزی"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">دسته</div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`chip ${category === cat ? 'chip-active' : 'chip-inactive'}`}
                  style={{ padding: '4px 12px', fontSize: '12px' }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-400 mb-2">زمان (دقیقه)</div>
              <input
                className="input-field"
                type="number"
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">کالری</div>
              <input
                className="input-field"
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">نفرات</div>
              <input
                className="input-field"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="text-xs text-gray-400 mb-2">مواد لازم</div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input-field min-w-0 flex-1"
                    placeholder={`ماده ${idx + 1}`}
                    value={ing}
                    onChange={(e) => updateList(ingredients, setIngredients, idx, e.target.value)}
                  />
                  {ingredients.length > 1 && (
                    <button
                      className="w-10 flex-shrink-0 flex items-center justify-center text-gray-500"
                      onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="mt-2 text-sm font-semibold"
              style={{ color: '#10b981' }}
              onClick={() => setIngredients([...ingredients, ''])}
            >
              + افزودن ماده
            </button>
          </div>

          {/* Steps */}
          <div>
            <div className="text-xs text-gray-400 mb-2">مراحل پخت</div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    className="input-field min-w-0 flex-1"
                    placeholder={`مرحله ${idx + 1}`}
                    value={step}
                    onChange={(e) => updateList(steps, setSteps, idx, e.target.value)}
                  />
                  {steps.length > 1 && (
                    <button
                      className="w-10 flex-shrink-0 flex items-center justify-center text-gray-500"
                      onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="mt-2 text-sm font-semibold"
              style={{ color: '#10b981' }}
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
  );
}
