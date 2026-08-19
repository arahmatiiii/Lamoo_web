import { useState } from 'react';
import { ChevronLeft, Star, Pencil } from 'lucide-react';
import { useStore, DietaryMode, AllergyType, AiProvider } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import { fa, parseIntFa } from '../utils/format';

const dietaryOptions: DietaryMode[] = ['حلال', 'بدون‌گوشت‌خوک', 'وگان', 'کتو', 'بدون‌گلوتن'];
const allergyOptions: AllergyType[] = ['گندم', 'آجیل', 'لبنیات', 'تخم‌مرغ'];

const aiProviders: { id: AiProvider; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'gemini',
    label: 'جمینای (رایگان)',
    hint: 'کلید رایگان را از aistudio.google.com بگیرید.',
    placeholder: 'AIza...',
  },
  {
    id: 'openrouter',
    label: 'اوپن‌روتر (رایگان)',
    hint: 'کلید را از openrouter.ai/keys بگیرید — مدل‌های رایگان.',
    placeholder: 'sk-or-...',
  },
  {
    id: 'anthropic',
    label: 'کلود (دقیق‌تر)',
    hint: 'کلید را از console.anthropic.com بگیرید — دقیق‌ترین تشخیص.',
    placeholder: 'sk-ant-...',
  },
];

export default function SettingsPage() {
  const store = useStore();
  const [showCalorieModal, setShowCalorieModal] = useState(false);
  const [showServingModal, setShowServingModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [calorieInput, setCalorieInput] = useState(store.calorieGoal.toString());
  const [servingInput, setServingInput] = useState(store.servingCount.toString());
  const [nameInput, setNameInput] = useState(store.userName);
  const providerKeys: Record<AiProvider, string> = {
    gemini: store.geminiApiKey,
    openrouter: store.openrouterApiKey,
    anthropic: store.anthropicApiKey,
  };
  const [apiKeyInput, setApiKeyInput] = useState(providerKeys[store.aiProvider]);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="حساب من" headline="تنظیمات" hideActions />

      <div className="scroll-content space-y-[26px]" style={{ paddingTop: 4 }}>
        {/* Profile card */}
        <div
          className="card-tint press rise"
          style={{ padding: 22, cursor: 'pointer' }}
          onClick={() => {
            setNameInput(store.userName);
            setShowProfileModal(true);
          }}
        >
          <div className="decorative-circle" style={{ width: 120, height: 120, bottom: -52, left: -30 }} />
          <div className="relative flex items-center gap-4">
            <div
              className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
              style={{ width: 60, height: 60, background: 'var(--accent)', fontSize: 19, boxShadow: 'var(--shadow-md)' }}
            >
              {store.userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate flex items-center gap-2" style={{ fontSize: 19, color: 'var(--text)' }}>
                {store.userName}
                <Pencil size={13} style={{ color: 'var(--accent-700)', flexShrink: 0 }} />
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--accent-700)' }}>
                {store.isPremium ? 'نسخه پریمیوم' : 'نسخه رایگان'}
              </div>
            </div>
            {!store.isPremium && (
              <button
                className="press flex-shrink-0 font-bold text-white"
                style={{ background: 'var(--accent)', borderRadius: 999, padding: '10px 18px', fontSize: 13 }}
                onClick={(e) => e.stopPropagation()}
              >
                <Star size={11} fill="#fff" className="inline ml-1" style={{ marginBottom: 1 }} />
                ارتقا
              </button>
            )}
          </div>
        </div>

        {/* Dietary mode */}
        <div className="rise">
          <div className="section-label mb-3">رژیم غذایی</div>
          <div className="flex gap-2 flex-wrap">
            {dietaryOptions.map((mode) => (
              <button
                key={mode}
                onClick={() => store.toggleDietaryMode(mode)}
                className={`chip press ${store.dietaryModes.includes(mode) ? 'chip-active' : 'chip-inactive'}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div className="rise">
          <div className="section-label mb-3">آلرژی‌ها</div>
          <div className="flex gap-2 flex-wrap">
            {allergyOptions.map((allergy) => (
              <button
                key={allergy}
                onClick={() => store.toggleAllergy(allergy)}
                className={`chip press ${store.allergies.includes(allergy) ? 'chip-active' : 'chip-inactive'}`}
              >
                {allergy}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="rise">
          <div className="section-label mb-3">اعلان‌ها و اهداف</div>
          <div className="card-lg" style={{ padding: '8px 20px' }}>
            <ToggleRow label="اعلان انقضا" value={store.notifyExpiry} onChange={store.setNotifyExpiry} />
            <ToggleRow label="پیشنهاد هفتگی" value={store.notifyWeeklySuggestions} onChange={store.setNotifyWeeklySuggestions} />
            <ToggleRow label="یادآوری خرید" value={store.notifyShopping} onChange={store.setNotifyShopping} />

            <div className="settings-row">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>هدف کالری</span>
              <button
                onClick={() => {
                  setCalorieInput(store.calorieGoal.toString());
                  setShowCalorieModal(true);
                }}
                className="flex items-center gap-1 text-sm font-bold press"
                style={{ color: 'var(--accent-700)' }}
              >
                {fa(store.calorieGoal)}
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="settings-row">
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>تعداد نفرات</span>
              <button
                onClick={() => {
                  setServingInput(store.servingCount.toString());
                  setShowServingModal(true);
                }}
                className="flex items-center gap-1 text-sm font-bold press"
                style={{ color: 'var(--accent-700)' }}
              >
                {fa(store.servingCount)} نفر
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* AI provider */}
        <div className="rise">
          <div className="section-label mb-3">هوش مصنوعی</div>
          <div className="card-lg space-y-[15px]" style={{ padding: 20 }}>
            <div className="flex gap-2 flex-wrap">
              {aiProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.setAiProvider(p.id);
                    setApiKeyInput(providerKeys[p.id]);
                  }}
                  className={`chip press ${store.aiProvider === p.id ? 'chip-active' : 'chip-inactive'}`}
                  style={{ padding: '9px 16px', fontSize: 12 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="text-xs leading-[1.75]" style={{ color: 'var(--neutral-600)' }}>
              {aiProviders.find((p) => p.id === store.aiProvider)?.hint} کلید فقط روی همین دستگاه ذخیره می‌شود.
            </div>
            <input
              className="pill-input"
              style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13, color: 'var(--neutral-500)' }}
              type="password"
              placeholder={aiProviders.find((p) => p.id === store.aiProvider)?.placeholder}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={() => {
                const key = apiKeyInput.trim();
                if (store.aiProvider === 'gemini') store.setGeminiApiKey(key);
                else if (store.aiProvider === 'openrouter') store.setOpenrouterApiKey(key);
                else store.setAnthropicApiKey(key);
                setApiKeySaved(true);
                setTimeout(() => setApiKeySaved(false), 2000);
              }}
            >
              {apiKeySaved ? '✓ ذخیره شد' : 'ذخیره کلید'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-2 rise" style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--neutral-500)' }}>
          لامو — نسخه ۱.۰.۰
          <br />
          مدیریت هوشمند آشپزخانه
        </div>
      </div>

      {/* Profile modal */}
      {showProfileModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
              <h2 className="font-bold mb-5" style={{ fontSize: 22, color: 'var(--text)' }}>ویرایش پروفایل</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نام و نام خانوادگی</div>
                  <input className="input-field rounded" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="مثلاً: علی رحمتی" />
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const name = nameInput.trim();
                    if (!name) return;
                    const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
                    store.setUserProfile(name, initials);
                    setShowProfileModal(false);
                  }}
                >
                  ذخیره
                </button>
                <button className="btn-ghost" onClick={() => setShowProfileModal(false)}>
                  انصراف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Calorie modal */}
      {showCalorieModal && (
        <EditValueSheet
          title="هدف کالری روزانه"
          value={calorieInput}
          unit="کالری"
          onChange={setCalorieInput}
          onSave={() => {
            store.setCalorieGoal(parseIntFa(calorieInput) || store.calorieGoal);
            setShowCalorieModal(false);
          }}
          onClose={() => setShowCalorieModal(false)}
        />
      )}

      {/* Serving modal */}
      {showServingModal && (
        <EditValueSheet
          title="تعداد نفرات"
          value={servingInput}
          unit="نفر"
          onChange={setServingInput}
          onSave={() => {
            store.setServingCount(parseIntFa(servingInput) || store.servingCount);
            setShowServingModal(false);
          }}
          onClose={() => setShowServingModal(false)}
        />
      )}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="settings-row">
      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
      <label className="toggle">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

function EditValueSheet({
  title,
  value,
  unit,
  onChange,
  onSave,
  onClose,
}: {
  title: string;
  value: string;
  unit: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <h2 className="font-bold mb-5" style={{ fontSize: 22, color: 'var(--text)' }}>{title}</h2>
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                className="input-field rounded min-w-0 flex-1"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={value}
                autoFocus
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChange(e.target.value)}
              />
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 80, background: 'var(--surface)', borderRadius: 16, color: 'var(--neutral-600)' }}
              >
                {unit}
              </div>
            </div>
            <button className="btn-primary" onClick={onSave}>ذخیره</button>
            <button className="btn-ghost" onClick={onClose}>انصراف</button>
          </div>
        </div>
      </div>
    </div>
  );
}
