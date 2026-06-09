import { useState } from 'react';
import { X, Users, Clock, Flame, ChevronLeft } from 'lucide-react';
import { useStore, Recipe } from '../store/useStore';

export default function RecipeDetailSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'substitutes'>('ingredients');

  const missingIngredients = recipe.ingredients.filter((ing) => !ing.available);

  const handleAddToShopping = () => {
    missingIngredients.forEach((ing) => {
      store.addShoppingItem({
        id: Date.now().toString() + Math.random(),
        name: ing.name,
        amount: '1',
        unit: 'عدد',
        emoji: '🛒',
        purchased: false,
        addedFrom: recipe.name,
      });
    });
    store.setShoppingMessage(`${missingIngredients.length} مورد از ${recipe.name} به لیست خرید اضافه شد`);
    onClose();
    store.setActiveTab('shopping');
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />

        <div className="flex justify-end px-5 mb-2">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1f2937] flex items-center justify-center"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-6xl" style={{ background: '#162032' }}>
            {recipe.emoji}
          </div>
        </div>

        <div className="px-5 pb-8 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">{recipe.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-400">
              <span className="flex items-center gap-1"><Clock size={14} />دقیقه {recipe.timeMinutes}</span>
              <span className="flex items-center gap-1"><Flame size={14} className="text-orange-400" />کالری {recipe.calories}</span>
              <span className="flex items-center gap-1"><Users size={14} />نفر {recipe.servings}</span>
            </div>
          </div>

          <div className="flex gap-6 border-b" style={{ borderColor: '#2d3748' }}>
            {[
              { key: 'ingredients', label: 'مواد' },
              { key: 'steps', label: 'مراحل' },
              { key: 'substitutes', label: 'جایگزین' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`recipe-tab ${activeTab === tab.key ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'ingredients' && (
            <div>
              {recipe.ingredients.map((ing, idx) => (
                <div key={idx} className="ingredient-row">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={`status-dot ${ing.available ? 'status-dot-green' : 'status-dot-red'}`} />
                    <span className="text-sm text-white">{ing.name}</span>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-md font-semibold"
                    style={{
                      background: ing.available ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      color: ing.available ? '#10b981' : '#ef4444',
                    }}
                  >
                    {ing.available ? 'موجود' : 'کمبود'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-3">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: '#10b981', color: '#000' }}
                  >
                    {idx + 1}
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'substitutes' && (
            <div className="space-y-2">
              {recipe.ingredients.filter((ing) => ing.substitute).map((ing, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-red-400">{ing.name}</span>
                  <ChevronLeft size={14} className="text-gray-500" />
                  <span className="text-emerald-400">{ing.substitute}</span>
                </div>
              ))}
              {recipe.ingredients.filter((ing) => ing.substitute).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">جایگزینی پیشنهاد نمی‌شود</p>
              )}
            </div>
          )}

          {missingIngredients.length > 0 ? (
            <button className="btn-primary" onClick={handleAddToShopping}>
              افزودن کمبودها به لیست خرید
            </button>
          ) : (
            <button className="btn-primary">🍳 شروع پخت</button>
          )}
        </div>
      </div>
    </div>
  );
}
