import { useState } from 'react';
import { ChevronLeft, Pencil, Plus, Sun, Moon } from 'lucide-react';
import { useStore, DietaryMode, AllergyType, AiProvider } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import HouseholdSection from './HouseholdSection';
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
  {
    id: 'ollama',
    label: 'اولاما کلود (رایگان)',
    hint: 'کلید را از ollama.com/settings/keys بگیرید — چند مدل رایگان در دسترس است. مدل موردنظر را هم پایین انتخاب یا وارد کنید.',
    placeholder: 'API key...',
  },
];

const ollamaModelSuggestions = [
  'gpt-oss:20b-cloud',
  'gpt-oss:120b-cloud',
  'qwen3-coder:480b-cloud',
  'deepseek-v3.1:671b-cloud',
  'gemma4:31b-cloud',
  'kimi-k2:1t-cloud',
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
    ollama: store.ollamaApiKey,
  };
  const [apiKeyInput, setApiKeyInput] = useState(providerKeys[store.aiProvider]);
  const [modelInput, setModelInput] = useState(store.ollamaModel);
  const [proxyInput, setProxyInput] = useState(store.ollamaProxyUrl);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showAddDietary, setShowAddDietary] = useState(false);
  const [customDietary, setCustomDietary] = useState('');
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [customAllergy, setCustomAllergy] = useState('');

  const allDietaryOptions = Array.from(new Set([...dietaryOptions, ...store.dietaryModes]));
  const allAllergyOptions = Array.from(new Set([...allergyOptions, ...store.allergies]));

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
              {store.userInitials || '👤'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold truncate flex items-center gap-2" style={{ fontSize: 19, color: 'var(--text)' }}>
                {store.userName || 'کاربر لامو'}
                <Pencil size={13} style={{ color: 'var(--accent-700)', flexShrink: 0 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Dietary mode */}
        <div className="rise">
          <div className="section-label mb-3">رژیم غذایی</div>
          <div className="flex gap-2 flex-wrap">
            {allDietaryOptions.map((mode) => (
              <button
                key={mode}
                onClick={() => store.toggleDietaryMode(mode)}
                className={`chip press ${store.dietaryModes.includes(mode) ? 'chip-active' : 'chip-inactive'}`}
              >
                {mode}
              </button>
            ))}
            <button
              onClick={() => setShowAddDietary(true)}
              className="chip press chip-inactive flex items-center gap-1"
            >
              <Plus size={13} strokeWidth={3} />
              افزودن
            </button>
          </div>
          {showAddDietary && (
            <div className="flex gap-2 mt-2">
              <input
                className="input-field rounded min-w-0 flex-1"
                style={{ fontSize: 13 }}
                placeholder="مثلاً: بدون‌قند"
                value={customDietary}
                autoFocus
                onChange={(e) => setCustomDietary(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const v = customDietary.trim();
                  if (v) store.toggleDietaryMode(v);
                  setCustomDietary('');
                  setShowAddDietary(false);
                }}
              />
              <button
                className="press flex-shrink-0 font-bold"
                style={{ padding: '0 16px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 13 }}
                onClick={() => {
                  const v = customDietary.trim();
                  if (v) store.toggleDietaryMode(v);
                  setCustomDietary('');
                  setShowAddDietary(false);
                }}
              >
                افزودن
              </button>
            </div>
          )}
        </div>

        {/* Allergies */}
        <div className="rise">
          <div className="section-label mb-3">آلرژی‌ها</div>
          <div className="flex gap-2 flex-wrap">
            {allAllergyOptions.map((allergy) => (
              <button
                key={allergy}
                onClick={() => store.toggleAllergy(allergy)}
                className={`chip press ${store.allergies.includes(allergy) ? 'chip-active' : 'chip-inactive'}`}
              >
                {allergy}
              </button>
            ))}
            <button
              onClick={() => setShowAddAllergy(true)}
              className="chip press chip-inactive flex items-center gap-1"
            >
              <Plus size={13} strokeWidth={3} />
              افزودن
            </button>
          </div>
          {showAddAllergy && (
            <div className="flex gap-2 mt-2">
              <input
                className="input-field rounded min-w-0 flex-1"
                style={{ fontSize: 13 }}
                placeholder="مثلاً: بادام‌زمینی"
                value={customAllergy}
                autoFocus
                onChange={(e) => setCustomAllergy(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const v = customAllergy.trim();
                  if (v) store.toggleAllergy(v);
                  setCustomAllergy('');
                  setShowAddAllergy(false);
                }}
              />
              <button
                className="press flex-shrink-0 font-bold"
                style={{ padding: '0 16px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 13 }}
                onClick={() => {
                  const v = customAllergy.trim();
                  if (v) store.toggleAllergy(v);
                  setCustomAllergy('');
                  setShowAddAllergy(false);
                }}
              >
                افزودن
              </button>
            </div>
          )}
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

        {/* Appearance */}
        <div className="rise">
          <div className="section-label mb-3">ظاهر</div>
          <div className="flex gap-2">
            <button
              onClick={() => store.setTheme('light')}
              className={`chip press flex-1 justify-center flex items-center gap-1.5 ${store.theme === 'light' ? 'chip-active' : 'chip-inactive'}`}
            >
              <Sun size={14} strokeWidth={2.5} />
              روشن
            </button>
            <button
              onClick={() => store.setTheme('dark')}
              className={`chip press flex-1 justify-center flex items-center gap-1.5 ${store.theme === 'dark' ? 'chip-active' : 'chip-inactive'}`}
            >
              <Moon size={14} strokeWidth={2.5} />
              تیره
            </button>
          </div>
        </div>

        <HouseholdSection />

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
                    setModelInput(store.ollamaModel);
                    setProxyInput(store.ollamaProxyUrl);
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
            {store.aiProvider === 'ollama' && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {ollamaModelSuggestions.map((m) => (
                    <button
                      key={m}
                      onClick={() => setModelInput(m)}
                      className={`chip press ${modelInput === m ? 'chip-active' : 'chip-inactive'}`}
                      style={{ padding: '6px 12px', fontSize: 11, direction: 'ltr' }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  className="pill-input"
                  style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13, color: 'var(--neutral-500)' }}
                  type="text"
                  placeholder="نام مدل، مثلاً gpt-oss:20b-cloud"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                />
                <div className="text-xs leading-[1.75]" style={{ color: 'var(--neutral-600)' }}>
                  سرور اولاما مستقیماً از مرورگر قابل دسترس نیست (محدودیت CORS، ربطی به اینترنت/VPN
                  ندارد). یک پراکسی رایگان بسازید (راهنما در پوشه cloudflare-worker) و آدرسش را اینجا
                  وارد کنید.
                </div>
                <input
                  className="pill-input"
                  style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13, color: 'var(--neutral-500)' }}
                  type="text"
                  placeholder="آدرس پراکسی، مثلاً https://xxx.workers.dev"
                  value={proxyInput}
                  onChange={(e) => setProxyInput(e.target.value)}
                />
              </div>
            )}
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
                else if (store.aiProvider === 'ollama') {
                  store.setOllamaApiKey(key);
                  store.setOllamaModel(modelInput.trim() || 'gpt-oss:20b-cloud');
                  store.setOllamaProxyUrl(proxyInput.trim());
                } else store.setAnthropicApiKey(key);
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
