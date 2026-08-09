import { useState } from 'react';
import { ChevronLeft, Star, Pencil } from 'lucide-react';
import { useStore, DietaryMode, AllergyType, AiProvider } from '../store/useStore';

const dietaryOptions: DietaryMode[] = ['حلال', 'بدون‌گوشت‌خوک', 'وگان', 'کتو', 'بدون‌گلوتن'];
const allergyOptions: AllergyType[] = ['گندم', 'آجیل', 'لبنیات', 'تخم‌مرغ'];

const aiProviders: { id: AiProvider; label: string; hint: string; placeholder: string }[] = [
  {
    id: 'gemini',
    label: 'جمینای (رایگان)',
    hint: 'کلید رایگان را از aistudio.google.com بگیرید — برای فاز تست مناسب است.',
    placeholder: 'AIza...',
  },
  {
    id: 'openrouter',
    label: 'اوپن‌روتر (رایگان)',
    hint: 'کلید را از openrouter.ai/keys بگیرید — مدل‌های رایگان با حدود ۵۰ درخواست در روز.',
    placeholder: 'sk-or-...',
  },
  {
    id: 'anthropic',
    label: 'کلود (دقیق‌تر)',
    hint: 'کلید را از console.anthropic.com بگیرید — پولی ولی دقیق‌ترین تشخیص.',
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

  function toPersianNum(n: number): string {
    return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="app-header">
        <h1 className="text-2xl font-bold text-white">تنظیمات</h1>
      </div>

      <div className="scroll-content px-4 pb-8 space-y-5">
        {/* Profile card */}
        <div
          className="card flex items-center gap-4 cursor-pointer"
          onClick={() => {
            setNameInput(store.userName);
            setShowProfileModal(true);
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
            style={{ background: '#10b981' }}
          >
            {store.userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-white truncate flex items-center gap-2">
              {store.userName}
              <Pencil size={13} className="text-gray-500 flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1 text-sm mt-0.5" style={{ color: '#f59e0b' }}>
              <Star size={12} fill="#f59e0b" />
              {store.isPremium ? 'نسخه پریمیوم' : 'نسخه رایگان — ارتقا دهید'}
            </div>
          </div>
          {!store.isPremium && (
            <button
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-black flex-shrink-0"
              style={{ background: '#f59e0b' }}
              onClick={(e) => e.stopPropagation()}
            >
              ارتقا
            </button>
          )}
        </div>

        {/* Dietary mode */}
        <div>
          <div className="text-xs text-gray-400 mb-3 px-1">رژیم غذایی</div>
          <div className="flex gap-2 flex-wrap">
            {dietaryOptions.map((mode) => (
              <button
                key={mode}
                onClick={() => store.toggleDietaryMode(mode)}
                className={`chip ${store.dietaryModes.includes(mode) ? 'chip-active' : 'chip-inactive'}`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Allergies */}
        <div>
          <div className="text-xs text-gray-400 mb-3 px-1">آلرژی‌ها</div>
          <div className="flex gap-2 flex-wrap">
            {allergyOptions.map((allergy) => (
              <button
                key={allergy}
                onClick={() => store.toggleAllergy(allergy)}
                className={`chip ${store.allergies.includes(allergy) ? 'chip-active' : 'chip-inactive'}`}
              >
                {allergy}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div className="text-xs text-gray-400 mb-3 px-1">اعلان‌ها و اهداف</div>
          <div className="card space-y-1">
            <ToggleRow
              icon="⏰"
              label="اعلان انقضا"
              value={store.notifyExpiry}
              onChange={store.setNotifyExpiry}
            />
            <ToggleRow
              icon="📅"
              label="پیشنهاد هفتگی"
              value={store.notifyWeeklySuggestions}
              onChange={store.setNotifyWeeklySuggestions}
            />
            <ToggleRow
              icon="🛒"
              label="یادآوری خرید"
              value={store.notifyShopping}
              onChange={store.setNotifyShopping}
            />

            {/* Calorie goal */}
            <div className="settings-row">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔥</span>
                <span className="text-sm font-medium text-white">هدف کالری</span>
              </div>
              <button
                onClick={() => setShowCalorieModal(true)}
                className="flex items-center gap-1 text-sm font-semibold"
                style={{ color: '#10b981' }}
              >
                › {toPersianNum(store.calorieGoal)}
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* Serving count */}
            <div className="settings-row">
              <div className="flex items-center gap-3">
                <span className="text-lg">👥</span>
                <span className="text-sm font-medium text-white">تعداد نفرات</span>
              </div>
              <button
                onClick={() => setShowServingModal(true)}
                className="flex items-center gap-1 text-sm font-semibold"
                style={{ color: '#10b981' }}
              >
                نفر {toPersianNum(store.servingCount)}
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* AI / scanner */}
        <div>
          <div className="text-xs text-gray-400 mb-3 px-1">هوش مصنوعی (اسکنر محصول)</div>
          <div className="card space-y-3">
            <div className="flex gap-2 flex-wrap">
              {aiProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    store.setAiProvider(p.id);
                    setApiKeyInput(providerKeys[p.id]);
                  }}
                  className={`chip ${store.aiProvider === p.id ? 'chip-active' : 'chip-inactive'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400 leading-5">
              {aiProviders.find((p) => p.id === store.aiProvider)?.hint}
              {' '}کلید فقط روی همین دستگاه ذخیره می‌شود.
            </div>
            <input
              className="input-field"
              style={{ direction: 'ltr', textAlign: 'left' }}
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

        {/* App info */}
        <div className="card">
          <div className="text-xs text-gray-500 text-center">
            آشپزخانه — نسخه ۱.۰.۰
            <br />
            مدیریت هوشمند آشپزخانه
          </div>
        </div>
      </div>

      {/* Calorie modal */}
      {showCalorieModal && (
        <EditValueSheet
          title="هدف کالری روزانه"
          value={calorieInput}
          unit="کالری"
          onChange={setCalorieInput}
          onSave={() => {
            store.setCalorieGoal(parseInt(calorieInput) || store.calorieGoal);
            setShowCalorieModal(false);
          }}
          onClose={() => setShowCalorieModal(false)}
        />
      )}

      {/* Profile modal */}
      {showProfileModal && (
        <div className="bottom-sheet-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="px-5 pb-8 space-y-4">
              <h2 className="text-lg font-bold text-white">ویرایش پروفایل</h2>
              <div>
                <div className="text-xs text-gray-400 mb-2">نام و نام خانوادگی</div>
                <input
                  className="input-field"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="مثلاً: علی رحمتی"
                />
              </div>
              <button
                className="btn-primary"
                onClick={() => {
                  const name = nameInput.trim();
                  if (!name) return;
                  const initials = name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('');
                  store.setUserProfile(name, initials);
                  setShowProfileModal(false);
                }}
              >
                ذخیره
              </button>
              <button
                className="w-full text-center text-gray-400 text-sm py-2"
                onClick={() => setShowProfileModal(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Serving modal */}
      {showServingModal && (
        <EditValueSheet
          title="تعداد نفرات"
          value={servingInput}
          unit="نفر"
          onChange={setServingInput}
          onSave={() => {
            store.setServingCount(parseInt(servingInput) || store.servingCount);
            setShowServingModal(false);
          }}
          onClose={() => setShowServingModal(false)}
        />
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
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
        <div className="px-5 pb-8 space-y-4">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <div className="flex gap-3">
            <input
              className="input-field min-w-0 flex-1"
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="input-field w-20 text-center text-gray-400">{unit}</div>
          </div>
          <button className="btn-primary" onClick={onSave}>
            ذخیره
          </button>
          <button className="w-full text-center text-gray-400 text-sm py-2" onClick={onClose}>
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}
