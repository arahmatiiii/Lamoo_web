import { useState } from 'react';
import { Search, Plus, Camera, X } from 'lucide-react';
import { useStore, PantryItem, Category } from '../store/useStore';

const categories: Category[] = ['همه', 'گوشت', 'سبزیجات', 'لبنیات', 'غلات', 'میوه', 'سایر'];

const categoryEmojis: Record<string, string> = {
  'همه': '',
  'گوشت': '🥩',
  'سبزیجات': '🥦',
  'لبنیات': '🥛',
  'غلات': '🌾',
  'میوه': '🍎',
  'سایر': '📦',
};

function getExpiryClass(days: number) {
  if (days <= 2) return 'expiry-danger';
  if (days <= 5) return 'expiry-warn';
  return 'expiry-ok';
}

function getExpiryText(days: number) {
  if (days === 1) return 'فردا';
  if (days === 0) return 'امروز';
  return `روز ${toPersianNum(days)}`;
}

function toPersianNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

function getProgressColor(days: number): string {
  if (days <= 2) return '#ef4444';
  if (days <= 7) return '#f59e0b';
  return '#10b981';
}

function getProgressWidth(days: number): number {
  const max = 30;
  return Math.min(100, (days / max) * 100);
}

export default function PantryPage() {
  const store = useStore();
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = store.pantryItems.filter((item) => {
    const matchCat = store.pantryCategory === 'همه' || item.category === store.pantryCategory;
    const matchSearch = item.name.includes(store.pantrySearch) || store.pantrySearch === '';
    return matchCat && matchSearch;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="app-header">
        <h1 className="text-2xl font-bold text-white">انبار غذا</h1>
        <button
          onClick={() => store.setActiveTab('scanner')}
          className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center"
        >
          <Search size={18} className="text-gray-300" />
        </button>
      </div>

      {/* Scanner Banner */}
      <div className="px-4 mb-3">
        <button
          onClick={() => store.setActiveTab('scanner')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: '#1a2535', border: '1px dashed #2d4d3a' }}
        >
          <Camera size={20} className="text-emerald-400" />
          <span className="text-sm font-medium" style={{ color: '#10b981' }}>
            اسکن محصول با تاریخ انقضا
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="search-input pr-9"
            placeholder="جستجو در انبار..."
            value={store.pantrySearch}
            onChange={(e) => store.setPantrySearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => store.setPantryCategory(cat)}
            className={`chip ${store.pantryCategory === cat ? 'chip-active' : 'chip-inactive'}`}
          >
            {categoryEmojis[cat] && <span className="ml-1">{categoryEmojis[cat]}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* Items count */}
      <div className="px-4 mb-3">
        <span className="text-sm text-gray-400">ماده غذایی {toPersianNum(filtered.length)}</span>
      </div>

      {/* Grid */}
      <div className="scroll-content px-4 pb-4">
        <div className="pantry-grid">
          {filtered.map((item) => (
            <PantryItemCard
              key={item.id}
              item={item}
              onSelect={() => {
                store.setSelectedItem(item);
                store.setActiveModal('pantryDetail');
              }}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-5xl mb-3">📭</span>
            <p className="text-sm">موردی یافت نشد</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddModal(true)}>
        <Plus size={24} />
      </button>

      {/* Item Detail Modal */}
      {store.activeModal === 'pantryDetail' && store.selectedItem && (
        <PantryDetailSheet
          item={store.selectedItem}
          onClose={() => store.setActiveModal(null)}
        />
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <AddItemSheet onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}

function PantryItemCard({ item, onSelect }: { item: PantryItem; onSelect: () => void }) {
  return (
    <div className="pantry-item-card" onClick={onSelect}>
      {/* Category label */}
      <div className="text-xs text-gray-500 mb-1">{item.category}</div>

      {/* Emoji */}
      <div className="text-3xl mb-2">{item.emoji}</div>

      {/* Name */}
      <div className="font-bold text-white text-sm mb-1">{item.name}</div>

      {/* Amount */}
      <div className="text-xs text-gray-400 mb-3">
        {item.amount}{item.unit !== item.amount ? item.unit : ''}
      </div>

      {/* Expiry */}
      <div className={`text-xs font-semibold mb-2 ${getExpiryClass(item.expiryDays)}`}>
        {item.expiryDays <= 2 ? '●' : '✓'} {getExpiryText(item.expiryDays)}
      </div>

      {/* Progress bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{
            width: `${getProgressWidth(item.expiryDays)}%`,
            background: getProgressColor(item.expiryDays),
          }}
        />
      </div>
    </div>
  );
}

function PantryDetailSheet({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const store = useStore();
  const relatedRecipes = store.recipes.filter((r) =>
    r.ingredients.some((ing) => ing.name.includes(item.name.split('(')[0].trim()))
  );

  const handleRemove = () => {
    store.removePantryItem(item.id);
    onClose();
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />

        <div className="px-5 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ background: '#162032' }}>
              {item.emoji}
            </div>
            <div>
              <div className="text-xl font-bold text-white">{item.name}</div>
              <div className="text-sm text-gray-400">دسته: {item.category}</div>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card-dark p-4">
              <div className="text-xs text-gray-400 mb-1">مقدار</div>
              <div className="text-lg font-bold text-white">{item.amount}{item.unit}</div>
            </div>
            <div className="card-dark p-4">
              <div className="text-xs text-gray-400 mb-1">انقضا</div>
              <div className={`text-lg font-bold ${getExpiryClass(item.expiryDays)}`}>
                {getExpiryText(item.expiryDays)}
              </div>
            </div>
          </div>

          {/* Related recipes */}
          {relatedRecipes.length > 0 && (
            <div className="card" style={{ background: '#162c20' }}>
              <div className="flex items-center gap-2 text-emerald-400">
                <span>💡</span>
                <span className="text-sm font-semibold">
                  {relatedRecipes.length} دستورپخت با این ماده می‌پزی نی!
                </span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <button
            onClick={() => {
              store.setActiveTab('recipes');
              onClose();
            }}
            className="btn-primary"
          >
            مشاهده دستوریخت‌ها
          </button>
          <button className="btn-danger" onClick={handleRemove}>
            حذف از انبار
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('سایر');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('گ');
  const [expiry, setExpiry] = useState('30');
  const [emoji, setEmoji] = useState('🥫');

  const emojis = ['🥩', '🐟', '🥦', '🧀', '🥚', '🫒', '🌾', '🍅', '🥕', '🧅', '🍋', '🫙'];

  const handleSave = () => {
    if (!name.trim() || !amount.trim()) return;
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name,
      category,
      amount,
      unit,
      expiryDays: parseInt(expiry) || 30,
      emoji,
      available: true,
    };
    store.addPantryItem(newItem);
    onClose();
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">افزودن ماده جدید</h2>
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
            <div className="text-xs text-gray-400 mb-2">نام ماده</div>
            <input
              className="input-field"
              placeholder="مثلاً: گوجه‌فرنگی"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-400 mb-2">مقدار</div>
              <input
                className="input-field"
                placeholder="مثلاً: 500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
              />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-2">واحد</div>
              <select
                className="input-field"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ appearance: 'none' }}
              >
                <option value="گ">گرم</option>
                <option value="کیلو">کیلوگرم</option>
                <option value="عدد">عدد</option>
                <option value="لیتر">لیتر</option>
                <option value="میل">میلی‌لیتر</option>
              </select>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 mb-2">دسته</div>
            <div className="flex gap-2 flex-wrap">
              {categories.filter((c) => c !== 'همه').map((cat) => (
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

          <div>
            <div className="text-xs text-gray-400 mb-2">روزهای تا انقضا</div>
            <input
              className="input-field"
              placeholder="مثلاً: 30"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              type="number"
            />
          </div>

          <button className="btn-primary" onClick={handleSave}>
            ذخیره ماده
          </button>
        </div>
      </div>
    </div>
  );
}
