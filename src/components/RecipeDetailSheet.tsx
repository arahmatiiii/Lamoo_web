import { useState } from 'react';
import { X, Users, Clock, Flame, ChevronLeft, Trash2, Check, Wand2, Camera } from 'lucide-react';
import { useStore, Recipe } from '../store/useStore';
import { suggestSubstitute, Substitute } from '../utils/ai';
import { useToast } from './Toast';
import CookMode from './CookMode';
import ShareCard from './ShareCard';
import { fa } from '../utils/format';

type SubState =
  | { state: 'loading' }
  | { state: 'done'; value: Substitute }
  | { state: 'error'; message: string };

export default function RecipeDetailSheet({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const store = useStore();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'substitutes'>('ingredients');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [cookConfirm, setCookConfirm] = useState<string[] | null>(null);
  const [cooking, setCooking] = useState(false);
  const [subs, setSubs] = useState<Record<string, SubState>>({});
  const [showShare, setShowShare] = useState(false);

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
    ollama: store.ollamaApiKey,
  }[store.aiProvider];

  const askSubstitute = async (ingredient: string) => {
    if (subs[ingredient]?.state === 'loading') return;
    if (!providerKey.trim()) {
      setSubs((s) => ({
        ...s,
        [ingredient]: { state: 'error', message: 'اول کلید API را در تنظیمات وارد کن.' },
      }));
      return;
    }
    setSubs((s) => ({ ...s, [ingredient]: { state: 'loading' } }));
    try {
      const value = await suggestSubstitute(
        store.aiProvider,
        providerKey.trim(),
        {
          recipeName: recipe.name,
          ingredient,
          allergies: store.allergies,
          dietaryModes: store.dietaryModes,
        },
        store.ollamaModel,
        store.ollamaProxyUrl
      );
      setSubs((s) => ({ ...s, [ingredient]: { state: 'done', value } }));
    } catch (err) {
      setSubs((s) => ({
        ...s,
        [ingredient]: {
          state: 'error',
          message: err instanceof Error ? err.message : 'پیدا نشد. دوباره امتحان کن.',
        },
      }));
    }
  };

  const missingIngredients = recipe.ingredients.filter((ing) => !ing.available);

  const handleDelete = () => {
    store.removeRecipe(recipe.id);
    onClose();
  };

  const availableIngredients = recipe.ingredients.filter((ing) => ing.available);

  const confirmCooking = (usedNames: string[]) => {
    const emptied = store.consumePantryItems(usedNames);
    if (emptied.length === 0) {
      showToast('نوش جان! 🍽️', 'success');
    } else {
      showToast(`نوش جان! ${fa(emptied.length)} قلم تمام‌شده علامت خورد 🍽️`, 'success', {
        label: 'برگردان',
        onClick: () => store.restorePantryItems(emptied),
      });
    }
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
    <>
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
              {recipe.ingredients.map((ing, idx) => {
                const sub = subs[ing.name];
                return (
                  <div key={idx} className="divider-row" style={{ padding: '15px 0' }}>
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="rounded-full flex-shrink-0"
                          style={{ width: 9, height: 9, background: ing.available ? 'var(--sage)' : 'var(--accent)' }}
                        />
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{ing.name}</span>
                      </div>
                      {ing.available ? (
                        <span className="pill pill-fresh">موجود</span>
                      ) : (
                        // Missing ingredients are the ones worth a substitute.
                        <button
                          className="press flex items-center gap-1 flex-shrink-0"
                          style={{ color: 'var(--accent-700)', fontSize: 12, fontWeight: 700 }}
                          onClick={() => askSubstitute(ing.name)}
                        >
                          {sub?.state === 'loading' ? (
                            <span className="flex gap-1">
                              <span className="dot-1 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
                              <span className="dot-2 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
                              <span className="dot-3 w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }} />
                            </span>
                          ) : (
                            <>
                              <Wand2 size={12} strokeWidth={2.5} />
                              چی بذارم جاش؟
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {sub?.state === 'done' && (
                      <div
                        className="mt-2.5 text-xs leading-[1.75]"
                        style={{
                          background: 'var(--sage-100)',
                          color: 'var(--sage-700)',
                          borderRadius: 16,
                          padding: '10px 14px',
                        }}
                      >
                        <span className="font-bold">{sub.value.substitute}</span>
                        {sub.value.note && <> — {sub.value.note}</>}
                      </div>
                    )}
                    {sub?.state === 'error' && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--accent-700)' }}>⚠️ {sub.message}</div>
                    )}
                  </div>
                );
              })}
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
                {Object.entries(subs)
                  .filter(([, s]) => s.state === 'done')
                  .map(([name, s]) => (
                    <div key={name} className="flex items-center gap-2 text-sm">
                      <span style={{ color: 'var(--accent-700)' }}>{name}</span>
                      <ChevronLeft size={15} style={{ color: 'var(--neutral-500)' }} />
                      <span style={{ color: 'var(--sage-700)' }}>
                        {(s as { state: 'done'; value: Substitute }).value.substitute}
                      </span>
                    </div>
                  ))}

                {recipe.ingredients.filter((ing) => ing.substitute).length === 0 &&
                  Object.values(subs).every((s) => s.state !== 'done') && (
                    <p className="text-sm text-center py-4 leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
                      توی تب «مواد» روی هر چیزی که نداری بزن تا جایگزینش رو بگم.
                    </p>
                  )}

                {store.allergies.length > 0 && (
                  <p className="text-xs pt-2 leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
                    حساسیت‌های ثبت‌شده‌ات رو در نظر می‌گیرم، ولی قبل از خوردن خودت هم برچسب رو چک کن.
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
              <button
                className="btn-primary"
                onClick={() =>
                  // Walk the steps first when there are any; the pantry is
                  // only settled up once the food is actually cooked.
                  recipe.steps.length > 0
                    ? setCooking(true)
                    : setCookConfirm(availableIngredients.map((ing) => ing.name))
                }
              >
                🍳 شروع پخت
              </button>
            )}
            {/* Offered, never forced — no feed to feed. */}
            <button
              className="btn-ghost flex items-center justify-center gap-2"
              onClick={() => setShowShare(true)}
            >
              <Camera size={16} />
              کارت «با لامو پختم»
            </button>
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

      {cooking && (
        <CookMode
          recipe={recipe}
          onClose={() => setCooking(false)}
          onFinish={() => {
            setCooking(false);
            setCookConfirm(availableIngredients.map((ing) => ing.name));
          }}
        />
      )}

      {showShare && (
        <ShareCard recipe={recipe} onClose={() => setShowShare(false)} />
      )}

      {cookConfirm && (
        <CookConfirmSheet
          ingredientNames={availableIngredients.map((ing) => ing.name)}
          selected={cookConfirm}
          onToggle={(name) =>
            setCookConfirm((prev) =>
              prev?.includes(name) ? prev.filter((n) => n !== name) : [...(prev ?? []), name]
            )
          }
          onCancel={() => setCookConfirm(null)}
          onConfirm={() => {
            const used = cookConfirm;
            setCookConfirm(null);
            confirmCooking(used);
          }}
        />
      )}
    </>
  );
}

/**
 * Amounts are optional in the pantry model, so "cooking" can only mark whole
 * items used up — which is too blunt to do silently. Let the cook confirm
 * exactly which ones actually ran out.
 */
function CookConfirmSheet({
  ingredientNames,
  selected,
  onToggle,
  onCancel,
  onConfirm,
}: {
  ingredientNames: string[];
  selected: string[];
  onToggle: (name: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    // Sits above the recipe sheet it was opened from (.bottom-sheet is z-41).
    <div className="bottom-sheet-overlay" style={{ zIndex: 60 }} onClick={onCancel}>
      <div className="bottom-sheet" style={{ zIndex: 61 }} onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <h2 className="font-bold mb-1" style={{ fontSize: 21, color: 'var(--text)' }}>
            چی تموم شد؟
          </h2>
          <p className="text-xs mb-4 leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
            هر چی که دیگه توی خونه نمونده رو تیک بزن تا از انبار کم بشه. بقیه دست‌نخورده می‌مونن.
          </p>

          <div className="card-lg mb-4" style={{ padding: '4px 18px' }}>
            {ingredientNames.map((name) => {
              const isChecked = selected.includes(name);
              return (
                <button
                  key={name}
                  onClick={() => onToggle(name)}
                  className="w-full flex items-center gap-3 divider-row press text-right"
                  style={{ padding: '13px 0' }}
                >
                  <span className={`checkbox-circle ${isChecked ? 'checked' : ''}`}>
                    {isChecked && <Check size={13} strokeWidth={3.5} className="text-white" />}
                  </span>
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
                    {name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <button className="btn-primary" onClick={onConfirm}>
              {selected.length > 0 ? `از انبار کم کن (${fa(selected.length)} قلم)` : 'چیزی کم نشد'}
            </button>
            <button className="btn-ghost" onClick={onCancel}>
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
