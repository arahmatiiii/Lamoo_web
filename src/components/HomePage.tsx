import { useState } from 'react';
import { Bell, User, Send, Clock, Flame, Package } from 'lucide-react';
import { useStore } from '../store/useStore';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'صبح بخیر، امروز چی می‌پزیم؟ 🌅';
  if (hour >= 12 && hour < 17) return 'ناهار چی داری؟ 🌞';
  if (hour >= 17 && hour < 21) return 'امشب چی بپزیم؟ 🌆';
  return 'دیر وقته! یه چیز سریع بپزیم؟ 🌙';
}

const aiResponses: Record<string, any> = {
  'سالاد': {
    query: '"امشب سالاد میگو می‌خوام"',
    recipe: 'سالاد میگو — بررسی انبار',
    availabilityPercent: 60,
    ingredients: [
      { name: 'میگو (فریز)', amount: '400گ', available: true },
      { name: 'سبزی مخلوط', amount: '100گ', available: false },
      { name: 'گوجه‌گیلاسی', amount: '250گ', available: true },
      { name: 'خیار', amount: '1 عدد', available: false },
      { name: 'پنیر فتا', amount: '100گ', available: true },
    ],
    substitutes: ['سبزی مخلوط ← کلم‌باکاهو', 'خیار ← کرفس'],
    steps: [
      'میگو را در روغن تفت دهید',
      'سبزیجات را مخلوط کنید',
      'سس بریزید و سرو کنید',
    ],
  },
};

export default function HomePage() {
  const store = useStore();
  const [inputVal, setInputVal] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<any>(null);

  const expiringItems = store.pantryItems.filter((i) => i.expiryDays <= 5);
  const soonExpiring = store.pantryItems.filter((i) => i.expiryDays <= 4 && i.expiryDays > 1);

  const handleAiSearch = () => {
    if (!inputVal.trim()) return;
    store.setAiLoading(true);
    setTimeout(() => {
      const key = Object.keys(aiResponses).find((k) => inputVal.includes(k));
      const result = key ? aiResponses[key] : {
        query: `"${inputVal}"`,
        recipe: 'دستورپخت پیشنهادی',
        availabilityPercent: 75,
        ingredients: [],
        substitutes: [],
        steps: [],
      };
      setResultData(result);
      setShowResult(true);
      store.setAiLoading(false);
      store.setAiResult(result);
      setInputVal('');
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAiSearch();
  };

  if (showResult && resultData) {
    return <AiResultPage data={resultData} onClose={() => setShowResult(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="app-header">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl font-bold text-white">آشپزخانه</span>
          <span className="text-2xl">🍳</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            onClick={() => store.setActiveTab('reminders')}
            className="relative w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center"
          >
            <Bell size={18} className="text-gray-300" />
            {store.reminders.filter((r) => !r.completed).length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
          <button
            onClick={() => store.setActiveTab('settings')}
            className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center"
          >
            <User size={18} className="text-gray-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-28 space-y-6">
        {/* AI Chat Card */}
        <div className="card" style={{ background: '#162c20' }}>
          <div className="text-emerald-400 text-sm font-medium mb-1">
            {getGreeting()}
          </div>
          <div className="text-white text-xl font-bold mb-4">چی دوست داری<br />برام بپزم؟</div>
          <div className="flex gap-2">
            <input
              className="search-input min-w-0 flex-1"
              placeholder="مثلاً: سالاد میگو..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ background: '#1a3328', borderColor: '#2d4d3a' }}
            />
            <button
              onClick={handleAiSearch}
              disabled={store.aiLoading}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#10b981' }}
            >
              {store.aiLoading ? (
                <div className="flex gap-1">
                  <span className="dot-1 w-1.5 h-1.5 rounded-full bg-black" />
                  <span className="dot-2 w-1.5 h-1.5 rounded-full bg-black" />
                  <span className="dot-3 w-1.5 h-1.5 rounded-full bg-black" />
                </div>
              ) : (
                <Send size={16} className="text-black" />
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-3">
            <div className="text-2xl font-bold" style={{ color: '#10b981' }}>{store.pantryItems.length}</div>
            <div className="text-xs text-gray-400 mt-1">مواد انبار</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold" style={{ color: '#ef4444' }}>
              {store.reminders.filter((r) => !r.completed).length}
            </div>
            <div className="text-xs text-gray-400 mt-1">یادآور</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>{store.recipes.length}</div>
            <div className="text-xs text-gray-400 mt-1">دستوری</div>
          </div>
        </div>

        {/* Expiry Alerts */}
        {soonExpiring.length > 0 && (
          <div className="alert-banner alert-warn">
            <span>⚠️</span>
            <span>یه {soonExpiring.length} روز دیگر منقضی می‌شود</span>
          </div>
        )}

        {expiringItems.some((i) => i.expiryDays === 1) && (
          <div className="alert-banner alert-danger">
            <span>🔴</span>
            <span>
              {expiringItems.find((i) => i.expiryDays === 1)?.name} فردا منقضی می‌شود
            </span>
          </div>
        )}

        {/* Recommendations */}
        <div>
          <div className="text-sm text-gray-400 mb-3">پیشنهاد بر اساس انبار</div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {store.recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="rec-card w-44 flex-shrink-0 overflow-hidden rounded-xl"
                onClick={() => {
                  store.setSelectedRecipe(recipe);
                  store.setActiveModal('recipeDetail');
                }}
              >
                <div
                  className="relative h-28 flex items-center justify-center"
                  style={{ background: '#162032' }}
                >
                  <span className="text-5xl">{recipe.emoji}</span>
                  <div
                    className="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-lg"
                    style={{
                      background: recipe.availabilityPercent === 100 ? '#10b981' : '#f59e0b',
                      color: '#000',
                    }}
                  >
                    {recipe.availabilityPercent}%
                  </div>
                </div>
                <div className="p-3">
                  <div className="text-sm font-bold text-white mb-1 truncate">{recipe.name}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {recipe.timeMinutes} دق
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame size={10} className="text-orange-400" />
                      {recipe.calories}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => store.setActiveTab('pantry')}
            className="card flex items-center gap-3 text-right p-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#162c20' }}>
              <Package size={20} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">انبار غذا</div>
              <div className="text-xs text-gray-400">{store.pantryItems.length} ماده</div>
            </div>
          </button>
          <button
            onClick={() => store.setActiveTab('shopping')}
            className="card flex items-center gap-3 text-right p-3"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1a2535' }}>
              <span className="text-xl">🛒</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">لیست خرید</div>
              <div className="text-xs text-gray-400">
                {store.shoppingItems.filter((i) => !i.purchased).length} مورد
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function AiResultPage({ data, onClose }: { data: any; onClose: () => void }) {
  const store = useStore();
  // tab state reserved for future use

  return (
    <div className="flex flex-col h-full fade-in">
      {/* Header */}
      <div className="app-header">
        <div>
          <div className="text-xs text-gray-400 mb-1">جستجو شد</div>
          <div className="text-sm font-semibold text-gray-200">{data.query}</div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center text-gray-400 text-xl">
          ×
        </button>
      </div>

      <div className="scroll-content px-4 pb-8 space-y-4">
        {/* Recipe header */}
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xl">🍽️</span>
              <span className="font-bold text-white text-lg leading-7">{data.recipe}</span>
            </div>
            <div
              className="avail-badge"
              style={{
                background: data.availabilityPercent >= 80 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                color: data.availabilityPercent >= 80 ? '#10b981' : '#f59e0b',
              }}
            >
              موجودی {data.availabilityPercent}%
            </div>
          </div>

          {/* Ingredients */}
          {data.ingredients.map((ing: any, idx: number) => (
            <div key={idx} className="ingredient-row">
              <div className="flex min-w-0 items-center gap-2">
                <div className={`status-dot ${ing.available ? 'status-dot-green' : 'status-dot-red'}`} />
                <span className="text-sm text-white">{ing.name}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-xs text-gray-400">{ing.amount}</span>
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
            </div>
          ))}
        </div>

        {/* Substitutes */}
        {data.substitutes.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span>💡</span>
              <span className="font-semibold text-white text-sm">جایگزین‌های پیشنهادی</span>
            </div>
            <ul className="space-y-1">
              {data.substitutes.map((sub: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-gray-500">◈</span>
                  {sub}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {data.steps.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <span>📋</span>
              <span className="font-semibold text-white text-sm">دستور پخت</span>
            </div>
            <ol className="space-y-2">
              {data.steps.map((step: string, idx: number) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ background: '#10b981', color: '#000' }}
                  >
                    {idx + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Action buttons */}
        <button
          onClick={() => {
            store.setActiveTab('shopping');
            onClose();
          }}
          className="btn-primary"
        >
          افزودن کمبودها به لیست خرید
        </button>
      </div>
    </div>
  );
}
