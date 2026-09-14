import { useState } from 'react';
import { Sparkles, Send, Clock, Flame, ShoppingBasket, Camera, X } from 'lucide-react';
import { useStore, Recipe } from '../store/useStore';
import { suggestRecipes } from '../utils/ai';
import ScreenHeader from './ScreenHeader';
import FreshnessRing from './FreshnessRing';
import { fa, expiryLabel } from '../utils/format';

function getKicker(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'صبح بخیر،';
  if (hour >= 12 && hour < 17) return 'ظهر بخیر،';
  if (hour >= 17 && hour < 21) return 'عصر بخیر،';
  return 'شب بخیر،';
}

function getHeadline(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'صبحونه چی داری؟';
  if (hour >= 12 && hour < 17) return 'ناهار چی بپزیم؟';
  if (hour >= 17 && hour < 21) return 'امشب چی بپزیم؟';
  return 'یه چیز سریع بپزیم؟';
}

export default function HomePage() {
  const store = useStore();
  const [inputVal, setInputVal] = useState('');
  const [resultQuery, setResultQuery] = useState('');
  const [resultRecipes, setResultRecipes] = useState<Recipe[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
  }[store.aiProvider];
  const hasApiKey = providerKey.trim().length > 0;

  const cookableCount = store.recipes.filter((r) => r.availabilityPercent === 100).length;

  const useSoon = store.pantryItems
    .filter((i) => i.expiryDays != null)
    .sort((a, b) => (a.expiryDays ?? 0) - (b.expiryDays ?? 0))
    .slice(0, 3);

  const suggestedRecipes = [...store.recipes].sort((a, b) => b.availabilityPercent - a.availabilityPercent);

  const soonestItem = useSoon[0];
  const suggestionChips = [
    soonestItem ? `با ${soonestItem.name.split('(')[0].trim()}` : 'با لپه',
    'زیر ۳۰ دقیقه',
    'سبک و کم‌کالری',
  ];

  const handleAiSearch = async (query = inputVal.trim()) => {
    if (!query || store.aiLoading) return;
    if (!hasApiKey) {
      setAiError('برای پیشنهاد هوشمند، ابتدا کلید API را در تنظیمات وارد کنید.');
      return;
    }
    setAiError(null);
    store.setAiLoading(true);
    try {
      const suggestions = await suggestRecipes(store.aiProvider, providerKey.trim(), query, store.pantryItems);
      const existing = new Set(store.recipes.map((r) => r.name.trim()));
      suggestions.forEach((r) => {
        if (!existing.has(r.name.trim())) store.addRecipe(r);
      });
      setResultQuery(query);
      setResultRecipes(suggestions);
      setInputVal('');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'خطای ناشناخته. دوباره امتحان کنید.');
    } finally {
      store.setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAiSearch();
  };

  if (resultRecipes) {
    return <AiResultPage query={resultQuery} recipes={resultRecipes} onClose={() => setResultRecipes(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker={`${getKicker()} ${store.userName.split(' ')[0]}`} headline={getHeadline()} />

      <div className="scroll-content space-y-[26px]" style={{ paddingTop: 4 }}>
        {/* Assistant card */}
        <div className="card-tint rise" style={{ padding: 22 }}>
          <div className="decorative-circle" style={{ width: 132, height: 132, top: -46, left: -34 }} />

          <div className="relative">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={17} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--accent-700)', letterSpacing: '0.03em' }}>
                دستیار آشپزی
              </span>
            </div>

            <div className="font-bold mb-4" style={{ fontSize: 21, lineHeight: 1.5, color: 'var(--accent-800)' }}>
              با {fa(store.pantryItems.length)} ماده‌ای که داری،
              <br />
              {fa(cookableCount)} غذا می‌شه پخت.
            </div>

            <div className="flex gap-2 mb-3">
              <input
                className="pill-input min-w-0 flex-1"
                placeholder="مثلاً: سالاد میگو…"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={() => handleAiSearch()}
                disabled={store.aiLoading}
                className="press flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 46, height: 46, background: 'var(--accent)', boxShadow: 'var(--shadow-md)' }}
              >
                {store.aiLoading ? (
                  <span className="flex gap-1">
                    <span className="dot-1 w-1.5 h-1.5 rounded-full bg-white" />
                    <span className="dot-2 w-1.5 h-1.5 rounded-full bg-white" />
                    <span className="dot-3 w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                ) : (
                  <Send size={16} className="text-white" />
                )}
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {suggestionChips.map((c) => (
                <button
                  key={c}
                  className="press"
                  style={{
                    padding: '7px 15px',
                    borderRadius: 999,
                    background: 'rgba(198,113,57,.14)',
                    color: 'var(--accent-700)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  onClick={() => setInputVal(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {aiError && (
              <button
                className="mt-3 w-full text-right text-xs leading-5"
                style={{ color: 'var(--accent-700)' }}
                onClick={() => !hasApiKey && store.setActiveTab('settings')}
              >
                ⚠️ {aiError}
              </button>
            )}
          </div>
        </div>

        {/* Use soon */}
        {useSoon.length > 0 && (
          <div className="rise">
            <div className="flex items-center justify-between mb-3">
              <span className="section-label">زودتر مصرف کن</span>
              <button
                className="text-xs font-semibold press"
                style={{ color: 'var(--accent-700)' }}
                onClick={() => store.setActiveTab('pantry')}
              >
                همه انبار
              </button>
            </div>
            <div className="flex" style={{ gap: 14 }}>
              {useSoon.map((item) => (
                <div
                  key={item.id}
                  className="card press flex-1 flex flex-col items-center min-w-0"
                  style={{ padding: '16px 12px', gap: 8 }}
                  onClick={() => store.setActiveTab('pantry')}
                >
                  <FreshnessRing days={item.expiryDays!} size={58} strokeWidth={5} emoji={item.emoji} emojiSize={25} />
                  <span className="text-xs font-bold truncate w-full text-center" style={{ color: 'var(--text)' }}>
                    {item.name}
                  </span>
                  <span className="text-xs font-bold" style={{ color: item.expiryDays! <= 2 ? '#8c491a' : item.expiryDays! <= 7 ? '#f6a06b' : '#7a8a5e' }}>
                    {expiryLabel(item.expiryDays!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Carousel */}
        {suggestedRecipes.length > 0 && (
          <div className="rise">
            <div className="section-label mb-3">پیشنهاد بر اساس انبار</div>
            <div
              className="flex overflow-x-auto"
              style={{ gap: 14, marginInline: -24, paddingInline: 24, scrollbarWidth: 'none' }}
            >
              {suggestedRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="card-lg press flex-shrink-0"
                  style={{ width: 196, overflow: 'hidden' }}
                  onClick={() => {
                    store.setSelectedRecipe(recipe);
                    store.setActiveModal('recipeDetail');
                  }}
                >
                  <div className="relative flex items-center justify-center" style={{ height: 132, background: 'var(--surface)' }}>
                    <div className="medallion" style={{ width: 84, height: 84, fontSize: 38 }}>{recipe.emoji}</div>
                    <span
                      className={`pill absolute ${recipe.availabilityPercent === 100 ? 'pill-sage' : 'pill-soon'}`}
                      style={{ top: 10, left: 10 }}
                    >
                      {recipe.availabilityPercent === 100 ? 'همه‌چی هست' : `${fa(recipe.availabilityPercent)}٪ موجود`}
                    </span>
                  </div>
                  <div style={{ padding: '14px 16px 17px' }}>
                    <div className="font-bold truncate mb-1.5" style={{ fontSize: 16, color: 'var(--text)' }}>{recipe.name}</div>
                    <div className="flex items-center gap-3" style={{ fontSize: 12, color: 'var(--neutral-600)' }}>
                      <span className="flex items-center gap-1">
                        <Clock size={11} strokeWidth={2.5} />
                        {fa(recipe.timeMinutes)} دق
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame size={11} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                        {fa(recipe.calories)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shortcut tiles */}
        <div className="grid grid-cols-2 gap-[14px] rise">
          <button
            onClick={() => store.setActiveTab('shopping')}
            className="card-tint-sage press text-right"
            style={{ padding: 18 }}
          >
            <div className="rounded-full flex items-center justify-center mb-3" style={{ width: 40, height: 40, background: 'var(--sage)' }}>
              <ShoppingBasket size={19} strokeWidth={2.5} className="text-white" />
            </div>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>لیست خرید</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--sage-700)' }}>
              {fa(store.shoppingItems.filter((i) => !i.purchased).length)} مورد مانده
            </div>
          </button>
          <button
            onClick={() => store.setActiveTab('scanner')}
            className="card press text-right"
            style={{ padding: 18 }}
          >
            <div className="medallion mb-3" style={{ width: 40, height: 40 }}>
              <Camera size={18} strokeWidth={2.5} style={{ color: 'var(--neutral-700)' }} />
            </div>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>اسکن محصول</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--neutral-600)' }}>تاریخ انقضا را بخوان</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function AiResultPage({
  query,
  recipes,
  onClose,
}: {
  query: string;
  recipes: Recipe[];
  onClose: () => void;
}) {
  const store = useStore();

  return (
    <div className="flex flex-col h-full fade-in">
      <div className="screen-header">
        <div className="min-w-0">
          <div className="header-kicker">پیشنهاد هوش مصنوعی برای</div>
          <div className="header-headline truncate" style={{ fontSize: 22 }}>«{query}»</div>
        </div>
        <button onClick={onClose} className="icon-btn press flex-shrink-0">
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="scroll-content space-y-4" style={{ paddingTop: 8 }}>
        <div className="callout callout-sage">
          <span>✅</span>
          <span>{fa(recipes.length)} دستور پخت کامل به «دستورپخت‌ها» اضافه شد</span>
        </div>

        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className="card-lg press"
            style={{ padding: 16 }}
            onClick={() => {
              store.setSelectedRecipe(recipe);
              store.setActiveModal('recipeDetail');
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="medallion flex-shrink-0" style={{ width: 52, height: 52, fontSize: 26 }}>
                {recipe.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-bold truncate" style={{ color: 'var(--text)' }}>{recipe.name}</div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: 'var(--neutral-600)' }}>
                  <span className="flex items-center gap-1">
                    <Clock size={11} strokeWidth={2.5} />
                    {fa(recipe.timeMinutes)} دق
                  </span>
                  <span className="flex items-center gap-1">
                    <Flame size={11} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                    {fa(recipe.calories)} کالری
                  </span>
                </div>
              </div>
              <span className={`pill flex-shrink-0 ${recipe.availabilityPercent >= 80 ? 'pill-fresh' : 'pill-soon'}`}>
                موجودی {fa(recipe.availabilityPercent)}٪
              </span>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {recipe.ingredients.map((ing, idx) => (
                <span key={idx} className="flex items-center gap-1" style={{ color: ing.available ? 'var(--sage-700)' : 'var(--accent-700)' }}>
                  <span className="rounded-full" style={{ width: 7, height: 7, background: ing.available ? 'var(--sage)' : 'var(--accent)' }} />
                  {ing.name}
                </span>
              ))}
            </div>
          </div>
        ))}

        <button className="btn-primary" onClick={onClose}>
          بازگشت به خانه
        </button>
      </div>
    </div>
  );
}
