import { useMemo, useState } from 'react';
import { Sparkles, Send, Clock, Flame, ShoppingBasket, Camera, X, Plus, Check, RefreshCw } from 'lucide-react';
import { useStore, Recipe, PantryItem } from '../store/useStore';
import { suggestRecipes } from '../utils/ai';
import { rankSuggestions, suggestionMeta, MOODS, Mood } from '../utils/suggest';
import ScreenHeader from './ScreenHeader';
import FreshnessRing from './FreshnessRing';
import { fa, expiryLabel, daysUntil } from '../utils/format';

function getKicker(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'صبح بخیر،';
  if (hour >= 12 && hour < 17) return 'ظهر بخیر،';
  if (hour >= 17 && hour < 21) return 'عصر بخیر،';
  return 'شب بخیر،';
}

function getHeadline(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'صبحونه چی می‌چسبه؟';
  if (hour >= 12 && hour < 17) return 'ناهار چی می‌چسبه؟';
  if (hour >= 17 && hour < 21) return 'امشب چی می‌چسبه؟';
  return 'یه چیز سریع می‌چسبه؟';
}

/** Tap-to-add staples, so a first-run pantry takes seconds instead of a form. */
const STARTER_ITEMS = ['تخم‌مرغ', 'شیر', 'پیاز', 'برنج', 'ماست', 'گوجه'];
/** Enough to suggest something from — the ask stays up until we have this many. */
const STARTER_TARGET = 3;

export default function HomePage() {
  const store = useStore();
  const [inputVal, setInputVal] = useState('');
  const [resultQuery, setResultQuery] = useState('');
  const [resultRecipes, setResultRecipes] = useState<Recipe[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood | undefined>();
  const [heroIndex, setHeroIndex] = useState(0);

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
    ollama: store.ollamaApiKey,
  }[store.aiProvider];
  const hasApiKey = providerKey.trim().length > 0;

  const suggestions = useMemo(
    () => rankSuggestions(store.recipes, store.pantryItems, mood),
    [store.recipes, store.pantryItems, mood]
  );
  const hero = suggestions.length > 0 ? suggestions[heroIndex % suggestions.length] : undefined;

  const useSoon = store.pantryItems
    .map((i) => ({ item: i, days: daysUntil(i.expiryDate) }))
    .filter((e): e is { item: PantryItem; days: number } => e.days != null)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3);

  const handleAiSearch = async (query = inputVal.trim()) => {
    if (!query || store.aiLoading) return;
    if (!hasApiKey) {
      setAiError('برای پیشنهاد هوشمند، ابتدا کلید API را در تنظیمات وارد کنید.');
      return;
    }
    setAiError(null);
    store.setAiLoading(true);
    try {
      const suggestions = await suggestRecipes(
        store.aiProvider,
        providerKey.trim(),
        query,
        store.pantryItems,
        store.ollamaModel,
        store.ollamaProxyUrl
      );
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
      <ScreenHeader
        kicker={store.userName.trim() ? `${getKicker()} ${store.userName.split(' ')[0]}` : getKicker().replace(/،$/, '')}
        headline={getHeadline()}
      />

      <div className="scroll-content space-y-[26px]" style={{ paddingTop: 4 }}>
        {/* Mood — three ways to narrow "what should I cook?" */}
        <div className="flex gap-2 flex-wrap rise">
          {MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMood(mood === m.id ? undefined : m.id);
                setHeroIndex(0);
              }}
              className={`chip press ${mood === m.id ? 'chip-active' : 'chip-inactive'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* One confident pick, with the reason behind it */}
        {hero ? (
          <div className="card-tint rise" style={{ padding: 22 }}>
            <div className="decorative-circle" style={{ width: 132, height: 132, top: -46, left: -34 }} />

            <div className="relative">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles size={17} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--accent-700)', letterSpacing: '0.03em' }}>
                  پیشنهاد لامو
                </span>
              </div>

              <div className="flex items-center gap-3.5 mb-3">
                <div className="medallion flex-shrink-0" style={{ width: 66, height: 66, fontSize: 32 }}>
                  {hero.recipe.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-bold truncate"
                    style={{ fontSize: 23, lineHeight: 1.35, color: 'var(--accent-800)' }}
                  >
                    {hero.recipe.name}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--accent-700)' }}>
                    {suggestionMeta(hero)}
                  </div>
                </div>
              </div>

              <div
                className="text-sm mb-4"
                style={{ color: 'var(--accent-700)', lineHeight: 1.7 }}
              >
                «{hero.reason}»
              </div>

              <div className="flex gap-2">
                <button
                  className="btn-primary flex-1"
                  onClick={() => {
                    store.setSelectedRecipe(hero.recipe);
                    store.setActiveModal('recipeDetail');
                  }}
                >
                  بریم بپزیم
                </button>
                {suggestions.length > 1 && (
                  <button
                    className="press flex-shrink-0 flex items-center justify-center gap-1.5 font-semibold"
                    style={{
                      borderRadius: 999,
                      padding: '0 18px',
                      background: 'var(--card)',
                      color: 'var(--accent-700)',
                      fontSize: 13,
                    }}
                    onClick={() => setHeroIndex((i) => i + 1)}
                  >
                    <RefreshCw size={14} strokeWidth={2.5} />
                    یکی دیگه
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : store.pantryItems.length < STARTER_TARGET ? (
          <QuickStartCard />
        ) : (
          <div className="card-tint rise" style={{ padding: 22 }}>
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={17} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-bold" style={{ color: 'var(--accent-700)' }}>پیشنهاد لامو</span>
              </div>
              <div className="font-bold mb-1.5" style={{ fontSize: 19, color: 'var(--accent-800)' }}>
                با همینا یه چیز خوشمزه درمیاد
              </div>
              <div className="text-sm" style={{ color: 'var(--accent-700)', lineHeight: 1.8 }}>
                هنوز دستور پختی نداری. پایین بنویس چی دوست داری تا برات پیدا کنم.
              </div>
            </div>
          </div>
        )}

        {/* Ask Lamoo for something specific */}
        <div className="rise">
          <div className="flex gap-2">
            <input
              className="pill-input min-w-0 flex-1"
              placeholder="یا بگو چی می‌خوای… مثلاً کوکوی سبزی"
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
              {useSoon.map(({ item, days }) => (
                <div
                  key={item.id}
                  className="card press flex-1 flex flex-col items-center min-w-0"
                  style={{ padding: '16px 12px', gap: 8 }}
                  onClick={() => store.setActiveTab('pantry')}
                >
                  <FreshnessRing days={days} size={58} strokeWidth={5} emoji={item.emoji} emojiSize={25} />
                  <span className="text-xs font-bold truncate w-full text-center" style={{ color: 'var(--text)' }}>
                    {item.name}
                  </span>
                  <span className="text-xs font-bold" style={{ color: days <= 2 ? '#8c491a' : days <= 7 ? '#f6a06b' : '#7a8a5e' }}>
                    {expiryLabel(days)}
                  </span>
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

/**
 * First run: no long form, just "name three things in your fridge" so Lamoo
 * has enough to suggest something straight away.
 */
function QuickStartCard() {
  const store = useStore();
  const [val, setVal] = useState('');
  const added = store.pantryItems.map((p) => p.name);

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    store.addPantryItem({
      id: `${Date.now()}-${trimmed}`,
      name: trimmed,
      category: 'سایر',
      amount: '',
      unit: 'عدد',
      emoji: '🥫',
      available: true,
    });
    setVal('');
  };

  return (
    <div className="card-tint rise" style={{ padding: 22 }}>
      <div className="decorative-circle" style={{ width: 132, height: 132, top: -46, left: -34 }} />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={17} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--accent-700)' }}>شروع کنیم</span>
        </div>
        <div className="font-bold mb-1.5" style={{ fontSize: 19, lineHeight: 1.5, color: 'var(--accent-800)' }}>
          {fa(STARTER_TARGET)} تا چیزی که تو یخچالت داری رو بگو
        </div>
        <div className="text-sm mb-4" style={{ color: 'var(--accent-700)', lineHeight: 1.8 }}>
          {added.length === 0
            ? 'همینا کافیه تا اولین پیشنهاد رو بدم.'
            : `${added.join('، ')} ✓ — ${fa(STARTER_TARGET - added.length)} تا مونده`}
        </div>

        <div className="flex gap-2 mb-3">
          <input
            className="pill-input min-w-0 flex-1"
            placeholder="مثلاً: تخم‌مرغ"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add(val)}
          />
          <button
            onClick={() => add(val)}
            className="press flex-shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 46, height: 46, background: 'var(--accent)', boxShadow: 'var(--shadow-md)' }}
          >
            <Plus size={18} strokeWidth={3} className="text-white" />
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {STARTER_ITEMS.filter((name) => !added.includes(name)).map((name) => (
            <button
              key={name}
              className="press"
              style={{
                padding: '7px 15px',
                borderRadius: 999,
                background: 'rgba(198,113,57,.14)',
                color: 'var(--accent-700)',
                fontSize: 12,
                fontWeight: 600,
              }}
              onClick={() => add(name)}
            >
              + {name}
            </button>
          ))}
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
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleAdd = (e: React.MouseEvent, recipe: Recipe) => {
    e.stopPropagation();
    if (addedIds.has(recipe.id)) return;
    store.addRecipe(recipe);
    setAddedIds((prev) => new Set(prev).add(recipe.id));
  };

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
          <span>✨</span>
          <span>{fa(recipes.length)} پیشنهاد — هر کدوم رو خواستی با دکمه + به «دستورپخت‌ها» اضافه کن</span>
        </div>

        {recipes.map((recipe) => {
          const isAdded = addedIds.has(recipe.id);
          return (
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
                <button
                  onClick={(e) => handleAdd(e, recipe)}
                  className="press flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{
                    width: 34,
                    height: 34,
                    background: isAdded ? 'var(--sage)' : 'var(--accent)',
                  }}
                  title={isAdded ? 'اضافه شد' : 'افزودن به دستورپخت‌ها'}
                >
                  {isAdded ? <Check size={15} className="text-white" strokeWidth={3} /> : <Plus size={16} className="text-white" strokeWidth={3} />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {recipe.ingredients.map((ing, idx) => (
                    <span key={idx} className="flex items-center gap-1" style={{ color: ing.available ? 'var(--sage-700)' : 'var(--accent-700)' }}>
                      <span className="rounded-full" style={{ width: 7, height: 7, background: ing.available ? 'var(--sage)' : 'var(--accent)' }} />
                      {ing.name}
                    </span>
                  ))}
                </div>
                <span className={`pill flex-shrink-0 ${recipe.availabilityPercent >= 80 ? 'pill-fresh' : 'pill-soon'}`}>
                  موجودی {fa(recipe.availabilityPercent)}٪
                </span>
              </div>
            </div>
          );
        })}

        <button className="btn-primary" onClick={onClose}>
          بازگشت به خانه
        </button>
      </div>
    </div>
  );
}
