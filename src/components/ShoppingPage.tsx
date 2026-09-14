import { useState } from 'react';
import { Plus, X, ShoppingCart, ClipboardCheck, ChevronLeft, Check } from 'lucide-react';
import { useStore, ShoppingItem } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import { fa } from '../utils/format';

export default function ShoppingPage() {
  const store = useStore();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showMarketSheet, setShowMarketSheet] = useState(false);
  const [toast, setToast] = useState('');

  const markets = [
    { name: 'اسنپ مارکت', emoji: '🟢', url: 'https://snapp.market/' },
    { name: 'تپسی مارکت', emoji: '🟠', url: 'https://www.tapsi.markets/' },
  ];

  const unpurchased = store.shoppingItems.filter((i) => !i.purchased);
  const purchased = store.shoppingItems.filter((i) => i.purchased);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleClear = () => {
    store.clearPurchasedItems();
    showToast('موارد خریداری‌شده حذف شدند');
  };

  const handleToggle = (id: string) => {
    store.toggleShoppingItem(id);
    const item = store.shoppingItems.find((i) => i.id === id);
    if (item && !item.purchased) {
      showToast(`${item.name} به‌عنوان خریداری‌شده علامت خورد`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="این هفته" headline="لیست خرید" />

      <div className="scroll-content space-y-[22px]" style={{ paddingTop: 4 }}>
        {/* Info callout */}
        {store.shoppingMessage && (
          <div className="callout callout-sage rise">
            <ClipboardCheck size={17} strokeWidth={2.5} style={{ color: 'var(--sage)', flexShrink: 0 }} />
            <span>{store.shoppingMessage}</span>
          </div>
        )}

        {/* For purchase */}
        {unpurchased.length > 0 && (
          <div className="rise">
            <div className="section-label mb-3">برای خرید · {fa(unpurchased.length)}</div>
            <div className="card-lg" style={{ padding: '6px 4px' }}>
              {unpurchased.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onToggle={() => handleToggle(item.id)} onDelete={() => store.removeShoppingItem(item.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Purchased */}
        {purchased.length > 0 && (
          <div className="rise">
            <div className="flex items-center justify-between mb-3">
              <span className="section-label">خریداری شده · {fa(purchased.length)}</span>
              <button className="text-xs font-semibold press" style={{ color: 'var(--accent-700)' }} onClick={handleClear}>
                پاک کردن
              </button>
            </div>
            <div className="card-lg" style={{ padding: '6px 4px' }}>
              {purchased.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onToggle={() => handleToggle(item.id)} onDelete={() => store.removeShoppingItem(item.id)} isPurchased />
              ))}
            </div>
          </div>
        )}

        {store.shoppingItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center rise">
            <div className="medallion mb-3" style={{ width: 64, height: 64, fontSize: 30 }}>🛒</div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>لیست خرید خالی است</p>
            <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>با دکمه + مورد اضافه کنید</p>
          </div>
        )}

        {/* Online shopping CTA */}
        <button
          className="press w-full flex items-center rise"
          style={{ background: 'var(--accent)', borderRadius: 32, padding: '20px 22px', boxShadow: 'var(--shadow-md)', gap: 14 }}
          onClick={() => setShowMarketSheet(true)}
        >
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, background: 'rgba(255,255,255,.22)', fontSize: 22 }}>
            🛵
          </div>
          <div className="flex-1 text-right min-w-0">
            <div className="font-bold text-white" style={{ fontSize: 16 }}>سفارش آنلاین</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--accent-200)' }}>اسنپ مارکت یا تپسی مارکت</div>
          </div>
          <ChevronLeft size={19} className="text-white flex-shrink-0" strokeWidth={2.5} />
        </button>
      </div>

      {/* Market chooser sheet */}
      {showMarketSheet && (
        <div className="bottom-sheet-overlay" onClick={() => setShowMarketSheet(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
              <h2 className="font-bold mb-1" style={{ fontSize: 22, color: 'var(--text)' }}>از کجا سفارش می‌دهی؟</h2>
              <div className="text-xs mb-4" style={{ color: 'var(--neutral-600)' }}>
                اگر اپلیکیشن روی گوشی نصب باشد، همان باز می‌شود.
              </div>
              <div className="space-y-3">
                {markets.map((m) => (
                  <button
                    key={m.name}
                    className="card press w-full flex items-center gap-3 text-right"
                    style={{ padding: 16 }}
                    onClick={() => {
                      window.open(m.url, '_blank', 'noopener');
                      setShowMarketSheet(false);
                    }}
                  >
                    <span className="text-2xl flex-shrink-0">{m.emoji}</span>
                    <span className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>{m.name}</span>
                    <ShoppingCart size={16} style={{ color: 'var(--sage)' }} className="flex-shrink-0" />
                  </button>
                ))}
                <button className="btn-ghost" onClick={() => setShowMarketSheet(false)}>
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      <button className="fab press" onClick={() => setShowAddSheet(true)}>
        <Plus size={24} strokeWidth={3} />
      </button>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Add sheet */}
      {showAddSheet && <AddShoppingItemSheet onClose={() => setShowAddSheet(false)} />}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
  isPurchased = false,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  isPurchased?: boolean;
}) {
  return (
    <div
      className="flex items-center divider-row"
      style={{ padding: '15px 18px', gap: 14, opacity: isPurchased ? 0.55 : 1, transition: 'opacity .2s ease' }}
    >
      <button onClick={onToggle} className={`checkbox-circle press ${isPurchased ? 'checked' : ''}`}>
        {isPurchased && <Check size={13} strokeWidth={3.5} className="text-white" />}
      </button>

      <div className="medallion flex-shrink-0" style={{ width: 38, height: 38, fontSize: 19 }}>{item.emoji}</div>

      <div className="flex-1 min-w-0">
        <span
          className="text-sm font-bold block truncate"
          style={{
            color: isPurchased ? 'var(--neutral-500)' : 'var(--text)',
            textDecoration: isPurchased ? 'line-through' : 'none',
          }}
        >
          {item.name}
        </span>
        {item.addedFrom && !isPurchased && (
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--neutral-500)' }}>از دستور «{item.addedFrom}»</div>
        )}
      </div>

      <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--neutral-600)' }}>
        {item.amount} {item.unit}
      </span>

      <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center flex-shrink-0 press" style={{ color: 'var(--neutral-400)' }}>
        <X size={13} />
      </button>
    </div>
  );
}

function AddShoppingItemSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('عدد');
  const [emoji, setEmoji] = useState('🛒');

  const emojis = ['🥦', '🥕', '🍅', '🧅', '🧄', '🥚', '🧀', '🥩', '🍗', '🐟', '🦐', '🥛', '🛒'];

  const handleSave = () => {
    if (!name.trim()) return;
    const newItem: ShoppingItem = { id: Date.now().toString(), name, amount, unit, emoji, purchased: false };
    store.addShoppingItem(newItem);
    onClose();
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ShoppingCart size={19} style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold" style={{ fontSize: 22, color: 'var(--text)' }}>افزودن به لیست</h2>
            </div>
            <button className="sheet-close press" onClick={onClose}>
              <X size={17} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>آیکون</div>
              <div className="flex gap-2 flex-wrap">
                {emojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className="press flex items-center justify-center text-lg"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
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
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نام محصول</div>
              <input className="input-field rounded" placeholder="مثلاً: سبزی مخلوط" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>مقدار</div>
                <input className="input-field rounded" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>واحد</div>
                <select className="input-field rounded" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ appearance: 'none' }}>
                  <option value="عدد">عدد</option>
                  <option value="گ">گرم</option>
                  <option value="کیلو">کیلوگرم</option>
                  <option value="لیتر">لیتر</option>
                  <option value="بسته">بسته</option>
                </select>
              </div>
            </div>

            <button className="btn-primary" onClick={handleSave}>
              افزودن به لیست
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
