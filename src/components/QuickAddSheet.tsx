import { useRef, useState } from 'react';
import { X, Sparkles, Check, Receipt } from 'lucide-react';
import { useStore, PantryItem } from '../store/useStore';
import { extractPantryItems, extractReceiptItems, frameToJpegBase64, ExtractedItem } from '../utils/ai';
import { useToast } from './Toast';
import { fa } from '../utils/format';

const EXAMPLES = ['دو تا تخم‌مرغ و یه شیر خریدم', 'نیم کیلو گوشت و ۳ تا پیاز'];

/**
 * Type one sentence, get a list back, check it, then save. The confirmation
 * step is the point — an extraction that quietly rewrote the pantry would be
 * impossible to trust.
 */
export default function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { showToast } = useToast();
  const [sentence, setSentence] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ExtractedItem[] | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const providerKey = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
    ollama: store.ollamaApiKey,
  }[store.aiProvider];

  /** Shared tail for both entry points: extract, then hand over for review. */
  const collect = async (extract: () => Promise<ExtractedItem[]>) => {
    if (loading) return;
    if (!providerKey.trim()) {
      setError('برای این کار اول کلید API را در تنظیمات وارد کن.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const items = await extract();
      setFound(items);
      setChosen(items.map((_, i) => i));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته. دوباره امتحان کن.');
    } finally {
      setLoading(false);
    }
  };

  const run = () => {
    const text = sentence.trim();
    if (!text) return;
    collect(() =>
      extractPantryItems(store.aiProvider, providerKey.trim(), text, store.ollamaModel, store.ollamaProxyUrl)
    );
  };

  const handleReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const base64 = frameToJpegBase64(img);
      URL.revokeObjectURL(img.src);
      collect(() =>
        extractReceiptItems(store.aiProvider, providerKey.trim(), base64, store.ollamaModel, store.ollamaProxyUrl)
      );
    };
    img.src = URL.createObjectURL(file);
  };

  const save = () => {
    const items = (found ?? []).filter((_, i) => chosen.includes(i));
    items.forEach((item) => {
      const newItem: PantryItem = {
        id: `${Date.now()}-${item.name}`,
        name: item.name,
        category: item.category,
        amount: item.amount,
        unit: item.unit,
        emoji: item.emoji,
        available: true,
      };
      store.addPantryItem(newItem);
    });
    onClose();
    showToast(`${fa(items.length)} مورد به انبار اضافه شد`);
  };

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="font-bold" style={{ fontSize: 21, color: 'var(--text)' }}>با یک جمله بگو</h2>
            </div>
            <button className="sheet-close press" onClick={onClose}>
              <X size={17} />
            </button>
          </div>
          <p className="text-xs mb-4 leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
            بنویس چی خریدی، خودم لیستش می‌کنم. قبل از ذخیره نشونت می‌دم.
          </p>

          <div className="flex gap-2 mb-3">
            <input
              className="pill-input min-w-0 flex-1"
              placeholder="مثلاً: دو تا تخم‌مرغ و یه شیر خریدم"
              value={sentence}
              autoFocus
              onChange={(e) => setSentence(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
            <button
              onClick={run}
              disabled={loading}
              className="press flex-shrink-0 flex items-center justify-center rounded-full"
              style={{ width: 46, height: 46, background: 'var(--accent)', boxShadow: 'var(--shadow-md)' }}
            >
              {loading ? (
                <span className="flex gap-1">
                  <span className="dot-1 w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="dot-2 w-1.5 h-1.5 rounded-full bg-white" />
                  <span className="dot-3 w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              ) : (
                <Sparkles size={17} className="text-white" />
              )}
            </button>
          </div>

          {!found && (
            <>
            <button
              className="press w-full flex items-center justify-center gap-2 mb-3 font-semibold"
              style={{
                background: 'var(--surface)',
                borderRadius: 999,
                padding: '13px 0',
                color: 'var(--neutral-700)',
                fontSize: 13,
              }}
              onClick={() => receiptInputRef.current?.click()}
            >
              <Receipt size={16} strokeWidth={2.5} />
              یا از رسید خرید عکس بگیر
            </button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReceipt}
            />
            <div className="flex gap-2 flex-wrap">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  className="press"
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    background: 'var(--surface)',
                    color: 'var(--neutral-700)',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                  onClick={() => setSentence(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            </>
          )}

          {error && (
            <button
              className="w-full text-right text-xs leading-5 mt-1"
              style={{ color: 'var(--accent-700)' }}
              onClick={() => !providerKey.trim() && (onClose(), store.setActiveTab('settings'))}
            >
              ⚠️ {error}
            </button>
          )}

          {found && (
            <>
              <div className="text-xs mt-4 mb-2" style={{ color: 'var(--neutral-600)' }}>
                اینا رو پیدا کردم — هر کدوم رو نمی‌خوای بردار:
              </div>
              <div className="card-lg mb-4" style={{ padding: '4px 18px' }}>
                {found.map((item, i) => {
                  const isChosen = chosen.includes(i);
                  return (
                    <button
                      key={`${item.name}-${i}`}
                      onClick={() =>
                        setChosen((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]))
                      }
                      className="w-full flex items-center gap-3 divider-row press text-right"
                      style={{ padding: '13px 0' }}
                    >
                      <span className={`checkbox-circle ${isChosen ? 'checked' : ''}`}>
                        {isChosen && <Check size={13} strokeWidth={3.5} className="text-white" />}
                      </span>
                      <span className="text-lg flex-shrink-0">{item.emoji}</span>
                      <span className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text)' }}>
                        {item.name}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--neutral-600)' }}>
                        {item.amount ? `${fa(item.amount)} ${item.unit}` : '—'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button className="btn-primary" onClick={save} disabled={chosen.length === 0}>
                {chosen.length > 0 ? `افزودن ${fa(chosen.length)} مورد به انبار` : 'چیزی انتخاب نشده'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
