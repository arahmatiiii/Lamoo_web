import { useState } from 'react';
import { Users, Copy, Check, LogOut, Loader2, Bell, BellOff, Server, ShieldCheck } from 'lucide-react';
import { useStore, type Backend } from '../store/useStore';
import { useToast } from './Toast';
import { createHouseholdSecret, formatInviteCode, parseInviteCode } from '../utils/household';
import {
  createServerHousehold,
  fetchMe,
  joinServerHousehold,
  leaveServerHousehold,
  signOut,
} from '../utils/serverApi';
import { disablePush, enablePush } from '../utils/push';
import AccountSheet from './AccountSheet';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  off: { text: 'خاموش', color: 'var(--neutral-500)' },
  connecting: { text: 'در حال اتصال…', color: 'var(--accent-700)' },
  live: { text: 'متصل', color: 'var(--sage-700)' },
  error: { text: 'قطع — دوباره تلاش می‌کنم', color: 'var(--accent-700)' },
};

const BACKENDS: { id: Backend; label: string; icon: typeof Server; blurb: string }[] = [
  {
    id: 'server',
    label: 'سرور خودم',
    icon: Server,
    blurb: 'اکانت داری، دوستان و استوری کار می‌کند، و یادآورها با اپ بسته هم نوتیف می‌دهند. سرور محتوا را می‌خواند.',
  },
  {
    id: 'relay',
    label: 'رلهٔ رمزشده',
    icon: ShieldCheck,
    blurb: 'بدون اکانت و بدون دوستان. همه‌چیز روی گوشی رمز می‌شود و هیچ‌کس — حتی رله — نمی‌تواند بخواند.',
  },
];

/** The shared-kitchen settings: pick a backend, then pair with the other phone. */
export default function HouseholdSection() {
  const store = useStore();
  const status = STATUS_LABEL[store.syncStatus] ?? STATUS_LABEL.off;

  return (
    <div className="rise">
      <div className="section-label mb-3">آشپزخانهٔ مشترک</div>
      <div className="card-lg space-y-[15px]" style={{ padding: 20 }}>
        <div className="flex items-center gap-2">
          <Users size={17} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>
            آشپزخانه‌ات را با کی شریک می‌شوی
          </span>
          <span className="text-xs font-bold" style={{ color: status.color }}>
            {store.syncStatus === 'off' ? '' : status.text}
          </span>
        </div>

        <div className="flex gap-2">
          {BACKENDS.map((option) => {
            const active = store.backend === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                className="press flex-1 flex items-center justify-center gap-1.5 text-xs font-bold"
                style={{
                  padding: '11px 8px',
                  borderRadius: 14,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--neutral-600)',
                }}
                onClick={() => store.setBackend(option.id)}
              >
                <Icon size={14} />
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
          {BACKENDS.find((option) => option.id === store.backend)?.blurb}
        </div>

        {store.backend === 'server' ? <ServerMode /> : <RelayMode />}
      </div>
    </div>
  );
}

// ---- your own server --------------------------------------------------------

function ServerMode() {
  const store = useStore();
  const { showToast } = useToast();
  const [urlInput, setUrlInput] = useState(store.serverUrl);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const token = store.authToken;
  const household = store.serverHousehold;

  /** Wraps a server call so every failure reaches the user as its own message. */
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const { household: made } = await createServerHousehold(store.serverUrl, token, 'آشپزخانهٔ ما');
      store.setServerHousehold(made);
      showToast('ساخته شد — کد را به پارتنرت بده');
    });

  const join = () =>
    run(async () => {
      const { household: joined } = await joinServerHousehold(store.serverUrl, token, codeInput);
      store.setServerHousehold(joined);
      setCodeInput('');
      showToast('وصل شدی! انبار و دستورها یکی می‌شن');
    });

  const leave = () =>
    run(async () => {
      await leaveServerHousehold(store.serverUrl, token);
      store.setServerHousehold(null);
      setConfirmLeave(false);
      showToast('از آشپزخانهٔ مشترک خارج شدی');
    });

  const refresh = () =>
    run(async () => {
      const me = await fetchMe(store.serverUrl, token);
      store.setServerSession(token, me.user, me.household);
      showToast('به‌روز شد');
    });

  const logout = () =>
    run(async () => {
      await signOut(store.serverUrl, token).catch(() => undefined);
      store.clearServerSession();
      showToast('خارج شدی');
    });

  const togglePush = () =>
    run(async () => {
      if (store.pushEnabled) {
        await disablePush(store.serverUrl, token);
        store.setPushEnabled(false);
        showToast('نوتیفیکیشن خاموش شد');
      } else {
        await enablePush(store.serverUrl, token);
        store.setPushEnabled(true);
        showToast('نوتیفیکیشن روشن شد');
      }
    });

  const copyCode = async () => {
    if (!household) return;
    try {
      await navigator.clipboard.writeText(household.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('کپی نشد — دستی انتخابش کن', 'error');
    }
  };

  return (
    <>
      <div>
        <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>آدرس سرورت</div>
        <input
          className="pill-input"
          style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13 }}
          type="text"
          placeholder="https://lamoo.example.com"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={() => urlInput.trim() !== store.serverUrl && store.setServerUrl(urlInput.trim())}
        />
        <div className="text-xs mt-2 leading-[1.75]" style={{ color: 'var(--neutral-500)' }}>
          راهنمای بالا آوردنش در پوشهٔ server هست — یک‌بار و حدود ۱۰ دقیقه.
        </div>
      </div>

      {!token || !store.account ? (
        <>
          <button className="btn-primary" onClick={() => setShowAccount(true)}>
            ورود یا ساخت اکانت
          </button>
          {showAccount && <AccountSheet onClose={() => setShowAccount(false)} />}
        </>
      ) : (
        <>
          <div
            className="flex items-center justify-between"
            style={{ background: 'var(--surface)', borderRadius: 18, padding: '13px 16px' }}
          >
            <div className="min-w-0">
              <div className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
                {store.account.displayName}
              </div>
              <div className="text-xs" style={{ color: 'var(--neutral-500)', direction: 'ltr' }}>
                @{store.account.handle}
              </div>
            </div>
            <button
              className="press flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
              style={{ color: 'var(--accent-700)' }}
              onClick={() => void logout()}
              disabled={busy}
            >
              <LogOut size={14} />
              خروج از اکانت
            </button>
          </div>

          <button
            className="press w-full flex items-center justify-between"
            style={{ background: 'var(--surface)', borderRadius: 18, padding: '13px 16px' }}
            onClick={() => void togglePush()}
            disabled={busy}
          >
            <span className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text)' }}>
              {store.pushEnabled ? <Bell size={16} style={{ color: 'var(--sage)' }} /> : <BellOff size={16} style={{ color: 'var(--neutral-600)' }} />}
              نوتیفیکیشن یادآورها
            </span>
            <span className="text-xs font-bold" style={{ color: store.pushEnabled ? 'var(--sage-700)' : 'var(--neutral-500)' }}>
              {store.pushEnabled ? 'روشن' : 'خاموش'}
            </span>
          </button>

          {household ? (
            <>
              <div>
                <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>
                  کد دعوت — با این کد هر کسی عضو آشپزخانه می‌شود، مثل رمز باهاش رفتار کن
                </div>
                <button
                  onClick={copyCode}
                  className="press w-full flex items-center justify-between"
                  style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 16px' }}
                >
                  <span className="text-sm font-bold" style={{ direction: 'ltr', letterSpacing: 2, color: 'var(--text)' }}>
                    {household.inviteCode}
                  </span>
                  {copied ? <Check size={16} style={{ color: 'var(--sage)' }} /> : <Copy size={16} style={{ color: 'var(--neutral-600)' }} />}
                </button>
              </div>

              <div className="text-xs leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
                {household.members.length > 1
                  ? `${household.members.map((m) => m.displayName).join('، ')} — یک انبار، یک لیست خرید، یک دفتر دستورپخت.`
                  : 'هنوز تنهایی. کد بالا را به همسر یا هم‌خونه‌ات بده.'}
              </div>

              {!confirmLeave ? (
                <button
                  className="press w-full flex items-center justify-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--accent-700)', padding: '8px 0' }}
                  onClick={() => setConfirmLeave(true)}
                >
                  <LogOut size={15} />
                  خروج از آشپزخانهٔ مشترک
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-center leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
                    این اکانت از خانه جدا می‌شود. اگر آخرین نفر باشی، انبار و دستورهای مشترک روی
                    سرور پاک می‌شوند.
                  </div>
                  <button className="btn-danger" onClick={() => void leave()} disabled={busy}>
                    بله، خارج شو
                  </button>
                  <button
                    className="w-full text-center text-sm py-2"
                    style={{ color: 'var(--neutral-600)' }}
                    onClick={() => setConfirmLeave(false)}
                  >
                    انصراف
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button className="btn-primary flex items-center justify-center gap-2" onClick={() => void create()} disabled={busy}>
                {busy && <Loader2 size={16} className="animate-spin" />}
                ساخت آشپزخانهٔ مشترک
              </button>
              <div className="text-xs text-center" style={{ color: 'var(--neutral-500)' }}>یا</div>
              <div className="flex gap-2">
                <input
                  className="pill-input min-w-0 flex-1"
                  style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13 }}
                  type="text"
                  placeholder="کد دعوت"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void join()}
                />
                <button
                  className="press flex-shrink-0 font-bold"
                  style={{ padding: '0 18px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 13 }}
                  onClick={() => void join()}
                  disabled={busy}
                >
                  وصل شو
                </button>
              </div>
            </>
          )}

          <button
            className="w-full text-center text-xs py-1"
            style={{ color: 'var(--neutral-500)' }}
            onClick={() => void refresh()}
            disabled={busy}
          >
            تازه‌سازی از سرور
          </button>
        </>
      )}
    </>
  );
}

// ---- the encrypted relay ----------------------------------------------------

function RelayMode() {
  const store = useStore();
  const { showToast } = useToast();
  const [relayInput, setRelayInput] = useState(store.householdRelayUrl);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const joined = store.householdSecret.length > 0;

  const create = () => {
    const relay = relayInput.trim();
    if (!relay) {
      showToast('اول آدرس رله را وارد کن', 'error');
      return;
    }
    store.joinHousehold(createHouseholdSecret(), relay);
    showToast('آشپزخانهٔ مشترک ساخته شد — کد را به پارتنرت بده');
  };

  const join = () => {
    const relay = relayInput.trim();
    const secret = parseInviteCode(codeInput);
    if (!relay) {
      showToast('اول آدرس رله را وارد کن', 'error');
      return;
    }
    if (!secret) {
      showToast('این کد درست نیست', 'error');
      return;
    }
    store.joinHousehold(secret, relay);
    setCodeInput('');
    showToast('وصل شدی! انبار و دستورها یکی می‌شن');
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(formatInviteCode(store.householdSecret));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('کپی نشد — دستی انتخابش کن', 'error');
    }
  };

  return (
    <>
      <div>
        <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>آدرس رله</div>
        <input
          className="pill-input"
          style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13 }}
          type="text"
          placeholder="https://lamoo-relay.xxx.workers.dev"
          value={relayInput}
          onChange={(e) => setRelayInput(e.target.value)}
          onBlur={() => joined && relayInput.trim() && store.joinHousehold(store.householdSecret, relayInput.trim())}
        />
        <div className="text-xs mt-2 leading-[1.75]" style={{ color: 'var(--neutral-500)' }}>
          راهنمای ساختش در پوشهٔ cloudflare-worker/relay هست — یک‌بار و حدود ۵ دقیقه.
        </div>
      </div>

      {joined ? (
        <>
          <div>
            <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>
              کد دعوت — این کد خودِ آشپزخونه‌ست، مثل رمز باهاش رفتار کن
            </div>
            <button
              onClick={copyCode}
              className="press w-full flex items-center justify-between"
              style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 16px' }}
            >
              <span className="text-xs font-bold min-w-0 truncate" style={{ direction: 'ltr', color: 'var(--text)' }}>
                {formatInviteCode(store.householdSecret)}
              </span>
              {copied ? <Check size={16} style={{ color: 'var(--sage)' }} /> : <Copy size={16} style={{ color: 'var(--neutral-600)' }} />}
            </button>
          </div>

          {!confirmLeave ? (
            <button
              className="press w-full flex items-center justify-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--accent-700)', padding: '8px 0' }}
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut size={15} />
              خروج از آشپزخانهٔ مشترک
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-center leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
                این گوشی از خانه جدا می‌شود. انبار و دستورهای مشترک از روی همین دستگاه پاک
                می‌شوند — روی گوشی بقیه سر جایشان می‌مانند.
              </div>
              <button
                className="btn-danger"
                onClick={() => {
                  store.leaveHousehold();
                  setConfirmLeave(false);
                  showToast('از آشپزخانهٔ مشترک خارج شدی');
                }}
              >
                بله، خارج شو
              </button>
              <button
                className="w-full text-center text-sm py-2"
                style={{ color: 'var(--neutral-600)' }}
                onClick={() => setConfirmLeave(false)}
              >
                انصراف
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <button className="btn-primary" onClick={create}>
            ساخت آشپزخانهٔ مشترک
          </button>
          <div className="text-xs text-center" style={{ color: 'var(--neutral-500)' }}>یا</div>
          <div className="flex gap-2">
            <input
              className="pill-input min-w-0 flex-1"
              style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 12 }}
              type="text"
              placeholder="کد دعوت را بچسبان"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button
              className="press flex-shrink-0 font-bold"
              style={{ padding: '0 18px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 13 }}
              onClick={join}
            >
              وصل شو
            </button>
          </div>
          <div className="text-xs leading-[1.75]" style={{ color: 'var(--neutral-500)' }}>
            با وصل شدن، انبار فعلی این گوشی با خانهٔ مشترک یکی می‌شود.
          </div>
        </>
      )}
    </>
  );
}
