import { useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { useStore, PantryItem, Category } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import FreshnessRing from './FreshnessRing';
import { fa, expiryLabel, expiryColor } from '../utils/format';

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

const EXPIRY_PILL_CLASS = { urgent: 'pill-urgent', soon: 'pill-soon', fresh: 'pill-fresh' } as const;

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
      <ScreenHeader kicker="انبار خانه" headline="چی داری؟" />

      {/* Search */}
      <div className="px-6 mb-1">
        <div className="relative">
          <Search size={17} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: '#a19786' }} />
          <input
            className="pill-input"
            style={{ paddingRight: 40 }}
            placeholder="جستجو در انبار..."
            value={store.pantrySearch}
            onChange={(e) => store.setPantrySearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto" style={{ padding: '16px 24px 4px', scrollbarWidth: 'none' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => store.setPantryCategory(cat)}
            className={`chip press ${store.pantryCategory === cat ? 'chip-active' : 'chip-inactive'}`}
          >
            {categoryEmojis[cat] && <span>{categoryEmojis[cat]}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* Items count */}
      <div className="section-label" style={{ padding: '14px 24px 10px' }}>
        {fa(filtered.length)} ماده در انبار
      </div>

      {/* Grid */}
      <div className="scroll-content" style={{ paddingTop: 0 }}>
        <div className="pantry-grid">
          {filtered.map((item, idx) => (
            <PantryItemCard
              key={item.id}
              item={item}
              delay={idx}
              onSelect={() => {
                store.setSelectedItem(item);
                store.setActiveModal('pantryDetail');
              }}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ color: 'var(--neutral-600)' }}>
            <div className="medallion mb-3" style={{ width: 64, height: 64, fontSize: 30 }}>📭</div>
            <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>موردی یافت نشد</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab press" onClick={() => setShowAddModal(true)}>
        <Plus size={24} strokeWidth={3} />
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

function PantryItemCard({ item, onSelect, delay }: { item: PantryItem; onSelect: () => void; delay: number }) {
  const status = item.expiryDays != null ? expiryColor(item.expiryDays) : 'fresh';
  return (
    <div
      className="card press rise"
      style={{ padding: '18px 16px', cursor: 'pointer', animationDelay: `${Math.min(delay, 6) * 0.04}s` }}
      onClick={onSelect}
    >
      <div className="flex flex-col items-center" style={{ gap: 12 }}>
        {item.expiryDays != null ? (
          <FreshnessRing days={item.expiryDays} size={74} strokeWidth={4.5} emoji={item.emoji} emojiSize={27} medallion />
        ) : (
          <div className="medallion" style={{ width: 74, height: 74, fontSize: 27 }}>{item.emoji}</div>
        )}

        <div className="text-center min-w-0 w-full">
          <div className="font-bold truncate" style={{ fontSize: 15, color: 'var(--text)' }}>{item.name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--neutral-600)' }}>
            {item.amount ? `${item.amount} ${item.unit}` : '—'}
          </div>
        </div>

        {item.expiryDays != null ? (
          <span className={`pill ${EXPIRY_PILL_CLASS[status]}`}>{expiryLabel(item.expiryDays)}</span>
        ) : (
          <span className="pill pill-neutral">بدون انقضا</span>
        )}
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

        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          {/* Header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="medallion" style={{ width: 64, height: 64, fontSize: 34 }}>
              {item.emoji}
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 19, color: 'var(--text)' }}>{item.name}</div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--neutral-600)' }}>دسته: {item.category}</div>
            </div>
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="card-lg" style={{ padding: 16 }}>
              <div className="text-xs mb-1" style={{ color: 'var(--neutral-600)' }}>مقدار</div>
              <div className="font-bold" style={{ fontSize: 17, color: 'var(--text)' }}>
                {item.amount ? `${item.amount} ${item.unit}` : 'ثبت نشده'}
              </div>
            </div>
            <div className="card-lg" style={{ padding: 16 }}>
              <div className="text-xs mb-1" style={{ color: 'var(--neutral-600)' }}>انقضا</div>
              <div className="font-bold" style={{ fontSize: 17, color: item.expiryDays != null ? 'var(--accent-700)' : 'var(--neutral-500)' }}>
                {item.expiryDays != null ? expiryLabel(item.expiryDays) : 'ثبت نشده'}
              </div>
            </div>
          </div>

          {/* Related recipes */}
          {relatedRecipes.length > 0 && (
            <div className="callout callout-accent mb-5">
              <span>💡</span>
              <span className="font-semibold">
                {fa(relatedRecipes.length)} دستورپخت با این ماده می‌پزی!
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => {
                store.setActiveTab('recipes');
                onClose();
              }}
              className="btn-primary"
            >
              مشاهده دستورپخت‌ها
            </button>
            <button className="btn-danger" onClick={handleRemove}>
              حذف از انبار
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddItemSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('سایر');
  const [amountMode, setAmountMode] = useState<'weight' | 'count'>('weight');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('گرم');
  const [expiry, setExpiry] = useState('');
  const [emoji, setEmoji] = useState('🥫');

  const emojis = ['🥩', '🐟', '🥦', '🧀', '🥚', '🫒', '🌾', '🍅', '🥕', '🧅', '🍋', '🫙'];
  const weightUnits = ['گرم', 'کیلوگرم', 'لیتر', 'میلی‌لیتر'];
  const countUnits = ['عدد', 'بسته', 'قالب', 'شاخه'];

  const switchMode = (mode: 'weight' | 'count') => {
    setAmountMode(mode);
    setUnit(mode === 'weight' ? 'گرم' : 'عدد');
  };

  const toEnDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

  const handleSave = () => {
    if (!name.trim()) return;
    const expiryNum = parseInt(toEnDigits(expiry.trim()));
    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: name.trim(),
      category,
      amount: amount.trim() ? toEnDigits(amount.trim()) : '',
      unit,
      expiryDays: Number.isFinite(expiryNum) ? expiryNum : undefined,
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
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>افزودن ماده جدید</h2>
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
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نام ماده</div>
              <input
                className="input-field rounded"
                placeholder="مثلاً: گوجه‌فرنگی"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نوع مقدار (اختیاری)</div>
              <div className="flex gap-2 mb-2">
                <button
                  className={`chip press ${amountMode === 'weight' ? 'chip-active' : 'chip-inactive'}`}
                  onClick={() => switchMode('weight')}
                >
                  ⚖️ وزنی / حجمی
                </button>
                <button
                  className={`chip press ${amountMode === 'count' ? 'chip-active' : 'chip-inactive'}`}
                  onClick={() => switchMode('count')}
                >
                  🔢 تعدادی
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input-field rounded"
                  placeholder={amountMode === 'weight' ? 'مثلاً: 500 (اختیاری)' : 'مثلاً: 3 (اختیاری)'}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="text"
                  inputMode="numeric"
                />
                <select
                  className="input-field rounded"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  style={{ appearance: 'none' }}
                >
                  {(amountMode === 'weight' ? weightUnits : countUnits).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>دسته</div>
              <div className="flex gap-2 flex-wrap">
                {categories.filter((c) => c !== 'همه').map((cat) => (
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

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>روزهای تا انقضا (اختیاری)</div>
              <input
                className="input-field rounded"
                placeholder="خالی بگذار اگر تاریخ انقضا ندارد"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                type="text"
                inputMode="numeric"
              />
            </div>

            <button className="btn-primary" onClick={handleSave}>
              ذخیره ماده
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
