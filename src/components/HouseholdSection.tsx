import { useState } from 'react';
import { Users, Copy, Check, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useToast } from './Toast';
import { createHouseholdSecret, formatInviteCode, parseInviteCode } from '../utils/household';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  off: { text: 'خاموش', color: 'var(--neutral-500)' },
  connecting: { text: 'در حال اتصال…', color: 'var(--accent-700)' },
  live: { text: 'متصل', color: 'var(--sage-700)' },
  error: { text: 'قطع — دوباره تلاش می‌کنم', color: 'var(--accent-700)' },
};

/**
 * Pairing is deliberately one secret, shared by hand. There are no accounts to
 * create and no server holding a password — which also means the code *is* the
 * household, so the UI has to say so plainly.
 */
export default function HouseholdSection() {
  const store = useStore();
  const { showToast } = useToast();
  const [relayInput, setRelayInput] = useState(store.householdRelayUrl);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const joined = store.householdSecret.length > 0;
  const status = STATUS_LABEL[store.syncStatus] ?? STATUS_LABEL.off;

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
    <div className="rise">
      <div className="section-label mb-3">آشپزخانهٔ مشترک</div>
      <div className="card-lg space-y-[15px]" style={{ padding: 20 }}>
        <div className="flex items-center gap-2">
          <Users size={17} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>
            {joined ? 'انبار و دستورها مشترک‌اند' : 'انبارت فقط روی همین گوشیه'}
          </span>
          <span className="text-xs font-bold" style={{ color: status.color }}>
            {joined ? status.text : ''}
          </span>
        </div>

        <div className="text-xs leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
          با همسر یا هم‌خونه‌ات یک انبار، یک لیست خرید و یک دفتر دستورپخت داشته باشید. همه‌چیز
          روی گوشی خودتان رمزنگاری می‌شود؛ رله فقط بستهٔ رمزشده را جابه‌جا می‌کند.
        </div>

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
                <span
                  className="text-xs font-bold min-w-0 truncate"
                  style={{ direction: 'ltr', color: 'var(--text)' }}
                >
                  {formatInviteCode(store.householdSecret)}
                </span>
                {copied ? (
                  <Check size={16} style={{ color: 'var(--sage)' }} />
                ) : (
                  <Copy size={16} style={{ color: 'var(--neutral-600)' }} />
                )}
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
      </div>
    </div>
  );
}
