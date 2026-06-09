import { useState } from 'react';
import { Trash2, Plus, X, ShoppingCart } from 'lucide-react';
import { useStore, ShoppingItem } from '../store/useStore';

export default function ShoppingPage() {
  const store = useStore();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [toast, setToast] = useState('');

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
      {/* Header */}
      <div className="app-header">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">لیست خرید</span>
          <span className="text-2xl">🛒</span>
        </div>
        {purchased.length > 0 && (
          <button
            onClick={handleClear}
            className="w-10 h-10 rounded-full bg-[#1f2937] flex items-center justify-center"
          >
            <Trash2 size={16} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Info message */}
      {store.shoppingMessage && (
        <div className="mx-4 mb-3 px-4 py-3 rounded-xl text-sm" style={{ background: '#162032', color: '#10b981' }}>
          📋 {store.shoppingMessage}
        </div>
      )}

      <div className="scroll-content px-4 pb-24 space-y-4">
        {/* For purchase */}
        {unpurchased.length > 0 && (
          <div>
            <div className="text-sm text-gray-400 mb-2">برای خرید ({unpurchased.length})</div>
            <div className="card space-y-0 p-0 overflow-hidden">
              {unpurchased.map((item, idx) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item.id)}
                  onDelete={() => store.removeShoppingItem(item.id)}
                  isLast={idx === unpurchased.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Purchased */}
        {purchased.length > 0 && (
          <div>
            <div className="text-sm text-gray-400 mb-2">خریداری شده ({purchased.length})</div>
            <div className="card space-y-0 p-0 overflow-hidden">
              {purchased.map((item, idx) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item.id)}
                  onDelete={() => store.removeShoppingItem(item.id)}
                  isLast={idx === purchased.length - 1}
                  isPurchased
                />
              ))}
            </div>
          </div>
        )}

        {store.shoppingItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-5xl mb-3">🛒</span>
            <p className="text-sm">لیست خرید خالی است</p>
            <p className="text-xs mt-1">با دکمه + مورد اضافه کنید</p>
          </div>
        )}

        {/* Online shopping banner */}
        <button
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl"
          style={{ background: '#1f2937', border: '1px solid #2d3748' }}
        >
          <span className="text-2xl">🛵</span>
          <span className="text-sm font-semibold" style={{ color: '#10b981' }}>
            سفارش آنلاین از سوپرمارکت
          </span>
        </button>
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddSheet(true)}>
        <Plus size={24} />
      </button>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Add sheet */}
      {showAddSheet && (
        <AddShoppingItemSheet onClose={() => setShowAddSheet(false)} />
      )}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onToggle,
  onDelete,
  isLast,
  isPurchased = false,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
  isLast: boolean;
  isPurchased?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-4"
      style={{
        borderBottom: isLast ? 'none' : '1px solid #1a2535',
        opacity: isPurchased ? 0.5 : 1,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`custom-checkbox ${isPurchased ? 'checked' : ''}`}
      >
        {isPurchased && <span className="text-black text-xs font-bold">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-semibold ${isPurchased ? 'line-through text-gray-500' : 'text-white'}`}
        >
          {item.name}
        </span>
        {item.addedFrom && !isPurchased && (
          <div className="text-xs text-gray-500 mt-0.5">از: {item.addedFrom}</div>
        )}
      </div>

      {/* Amount */}
      <span className="text-xs text-gray-400 ml-2">
        {item.amount} {item.unit}
      </span>

      {/* Emoji */}
      <span className="text-lg">{item.emoji}</span>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-400"
      >
        <X size={12} />
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
    const newItem: ShoppingItem = {
      id: Date.now().toString(),
      name,
      amount,
      unit,
      emoji,
      purchased: false,
    };
    store.addShoppingItem(newItem);
    onClose();
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-5 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-400" />
              <h2 className="text-lg font-bold text-white">افزودن به لیست</h2>
            </div>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Emoji */}
          <div>
            <div className="text-xs text-gray-400 mb-2">آیکون</div>
            <div className="flex gap-2 flex-wrap">
              {emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
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
            <div className="text-xs text-gray-400 mb-2">نام محصول</div>
            <input
              className="input-field"
              placeholder="مثلاً: سبزی مخلوط"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-400 mb-2">مقدار</div>
              <input
                className="input-field"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
  );
}
