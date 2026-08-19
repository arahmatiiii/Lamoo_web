import { useState } from 'react';
import { X, Users, Clock, Flame, ChevronLeft, Trash2 } from 'lucide-react';
import { useStore, Recipe } from '../store/useStore';
import { fa } from '../utils/format';

export default function RecipeDetailSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const store = useStore();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'substitutes'>('ingredients');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const missingIngredients = recipe.ingredients.filter((ing) => !ing.available);

  const handleDelete = () => {
    store.removeRecipe(recipe.id);
    onClose();
  };

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
        {/* Hero */}
        <div
          className="relative flex items-center justify-center"
          style={{ height: 236, background: 'var(--surface)', borderRadius: '40px 40px 0 0' }}
        >
          <div className="medallion" style={{ width: 140, height: 140, fontSize: 64 }}>
            {recipe.emoji}
          </div>
          <button
            onClick={onClose}
            className="sheet-close press absolute"
            style={{ top: 16, left: 16 }}
          >
            <X size={17} />
          </button>
          <span
            className={`pill absolute ${recipe.availabilityPercent === 100 ? 'pill-sage' : 'pill-accent'}`}
            style={{ top: 18, right: 18 }}
          >
            {recipe.availabilityPercent === 100 ? 'همه‌چی هست' : `${fa(recipe.availabilityPercent)}٪ موجود`}
          </span>
        </div>

        <div className="px-6" style={{ paddingTop: 24, paddingBottom: 32 }}>
          <div className="mb-[22px]">
            <h2 className="font-bold mb-2" style={{ fontSize: 28, letterSpacing: '-0.015em', color: 'var(--text)' }}>
              {recipe.name}
            </h2>
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

          {/* Segmented control */}
          <div className="segmented mb-[22px]">
            {[
              { key: 'ingredients', label: 'مواد' },
              { key: 'steps', label: 'مراحل' },
              { key: 'substitutes', label: 'جایگزین' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`segment ${activeTab === tab.key ? 'segment-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'ingredients' && (
            <div className="card-lg mb-[22px]" style={{ padding: '8px 20px' }}>
              {recipe.ingredients.map((ing, idx) => (
                <div key={idx} className="flex items-center justify-between divider-row" style={{ padding: '15px 0' }}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="rounded-full flex-shrink-0"
                      style={{ width: 9, height: 9, background: ing.available ? 'var(--sage)' : 'var(--accent)' }}
                    />
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{ing.name}</span>
                  </div>
                  <span className={`pill ${ing.available ? 'pill-fresh' : 'pill-soon'}`}>
                    {ing.available ? 'موجود' : 'کمبود'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'steps' && (
            <div className="space-y-4 mb-[22px]">
              {recipe.steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span
                    className="rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white"
                    style={{ width: 30, height: 30, fontSize: 13, background: 'var(--sage)' }}
                  >
                    {fa(idx + 1)}
                  </span>
                  <p className="text-sm leading-[1.75]" style={{ color: 'var(--step-text)' }}>{step}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'substitutes' && (
            <div className="card-tint-sage mb-[22px]" style={{ padding: 20 }}>
              <div className="space-y-3.5">
                {recipe.ingredients.filter((ing) => ing.substitute).map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span style={{ color: 'var(--accent-700)' }}>{ing.name}</span>
                    <ChevronLeft size={15} style={{ color: 'var(--neutral-500)' }} />
                    <span style={{ color: 'var(--sage-700)' }}>{ing.substitute}</span>
                  </div>
                ))}
                {recipe.ingredients.filter((ing) => ing.substitute).length === 0 && (
                  <p className="text-sm text-center py-4" style={{ color: 'var(--neutral-600)' }}>
                    برای این دستور جایگزینی پیشنهاد نمی‌شود.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {missingIngredients.length > 0 ? (
              <button className="btn-primary" onClick={handleAddToShopping}>
                {fa(missingIngredients.length)} کمبود را به لیست خرید اضافه کن
              </button>
            ) : (
              <button className="btn-primary">🍳 شروع پخت</button>
            )}
            <button className="btn-ghost" onClick={onClose}>
              بستن
            </button>

            {!confirmDelete ? (
              <button
                className="w-full text-center text-sm font-semibold press flex items-center justify-center gap-2"
                style={{ color: 'var(--accent-700)', padding: '10px 0' }}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
                حذف دستور پخت
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-center" style={{ color: 'var(--neutral-600)' }}>
                  «{recipe.name}» برای همیشه حذف شود؟
                </div>
                <button className="btn-danger" onClick={handleDelete}>
                  بله، حذف کن
                </button>
                <button
                  className="w-full text-center text-sm py-2"
                  style={{ color: 'var(--neutral-600)' }}
                  onClick={() => setConfirmDelete(false)}
                >
                  انصراف
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
