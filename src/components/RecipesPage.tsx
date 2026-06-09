import { useState } from 'react';
import { Search, Users, Clock, Flame } from 'lucide-react';
import { useStore, Recipe } from '../store/useStore';
import RecipeDetailSheet from './RecipeDetailSheet';

const filters = ['همه', 'الان‌بیز', 'زیر ۳۰ دق', 'سالاد', 'سوپ', 'کباب'];

export default function RecipesPage() {
  const store = useStore();
  const [showSearch, setShowSearch] = useState(false);

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
      <div className="scroll-content px-4 pb-4 space-y-4">
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

        {recipe.availabilityPercent === 100 && (
          <div
            className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-lg"
            style={{ background: '#10b981', color: '#000' }}
          >
            ۱۰۰% موجود
          </div>
        )}

        {recipe.usesSoonExpiring && (
          <div
            className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            <span>⚠️</span>
            استفاده از لپه
          </div>
        )}

        {recipe.availabilityPercent < 100 && !recipe.usesSoonExpiring && (
          <div
            className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(245,158,11,0.9)', color: '#000' }}
          >
            {recipe.availabilityPercent}% موجود
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="text-lg font-bold text-white mb-2">{recipe.name}</div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
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
