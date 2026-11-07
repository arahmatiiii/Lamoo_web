import { useEffect, useState } from 'react';
import { Users, Copy, Check, LogOut, Loader2, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useToast } from './Toast';
import { fetchHousehold, fetchMe, joinHousehold, leaveHousehold, signOut } from '../utils/serverApi';
import AccountSheet from './AccountSheet';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  off: { text: 'خاموش', color: 'var(--neutral-500)' },
  connecting: { text: 'در حال اتصال…', color: 'var(--accent-700)' },
  live: { text: 'همگام', color: 'var(--sage-700)' },
  error: { text: 'قطع — دوباره تلاش می‌کنم', color: 'var(--accent-700)' },
};

/** Two people, by product decision: one kitchen, two phones, no more. */
const MAX_MEMBERS = 2;

/**
 * The shared kitchen, in the app's single-server world:
 *
 * every signed-in account has a kitchen of its own and a code for it. Entering
 * somebody else's code pairs the two accounts into one kitchen, and that is the
 * only way to share — there is no relay, no self-hosted address, and no
 * third state. The server enforces the two-person cap; the UI only explains it.
 */
export default function HouseholdSection() {
  const store = useStore();
  const { showToast } = useToast();
  const [showAccount, setShowAccount] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const token = store.authToken;
  const household = store.serverHousehold;
  const status = STATUS_LABEL[store.syncStatus] ?? STATUS_LABEL.off;

  // A session restored from storage carries the token but not always the
  // kitchen's current code, so fetch it rather than showing an empty box.
  useEffect(() => {
    if (!token || household) return;
    let alive = true;
    fetchHousehold(token)
      .then(({ household: fetched }) => {
        if (alive) useStore.getState().setServerHousehold(fetched);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, household]);

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

  const join = () =>
    run(async () => {
      const code = codeInput.trim();
      if (!code) {
        showToast('کد طرف مقابل را وارد کن', 'error');
        return;
      }
      const { household: joined } = await joinHousehold(token, code);
      useStore.getState().setServerHousehold(joined);
      setCodeInput('');
      showToast('وصل شدی! از حالا یک آشپزخانه دارید');
    });

  const leave = () =>
    run(async () => {
      const { household: fresh } = await leaveHousehold(token);
      useStore.getState().setServerHousehold(fresh);
      setConfirmLeave(false);
      showToast('جدا شدی — یک آشپزخانهٔ تازه برای خودت ساخته شد');
    });

  const refresh = () =>
    run(async () => {
      const me = await fetchMe(token);
      useStore.getState().setServerSession(token, me.user, me.household);
      showToast('به‌روز شد');
    });

  const logout = () =>
    run(async () => {
      await signOut(token).catch(() => undefined);
      useStore.getState().clearServerSession();
      showToast('خارج شدی');
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

  const partner = household?.members.find((member) => member.id !== store.account?.id);
  const full = (household?.members.length ?? 0) >= MAX_MEMBERS;

  return (
    <div className="rise">
      <div className="section-label mb-3">آشپزخانهٔ مشترک</div>
      <div className="card-lg space-y-[15px]" style={{ padding: 20 }}>
        <div className="flex items-center gap-2">
          <Users size={17} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-bold flex-1" style={{ color: 'var(--text)' }}>
            یک آشپزخانه، حداکثر دو نفر
          </span>
          {token && (
            <span className="text-xs font-bold" style={{ color: status.color }}>
              {status.text}
            </span>
          )}
        </div>

        <div className="text-xs leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
          کد آشپزخانهٔ خودت را به همسر یا هم‌خانه‌ات بده، یا کد او را اینجا وارد کن. هر کدام
          یکی را بزند، از همان لحظه انبار، لیست خرید و دستورها یکی می‌شوند — و کد دیگری
          پذیرفته نمی‌شود تا وقتی یکی‌تان جدا شود.
        </div>

        {!token || !store.account ? (
          <>
            <button className="btn-primary" onClick={() => setShowAccount(true)}>
              ورود یا ساخت اکانت
            </button>
            <div className="text-xs leading-[1.8]" style={{ color: 'var(--neutral-500)' }}>
              برای این بخش باید روی سرور اصلی لامو حساب داشته باشی. بدون حساب هم اپ روی
              همین گوشی کار می‌کند، فقط مشترک نیست.
            </div>
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

            {household ? (
              <>
                <div>
                  <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>
                    <KeyRound size={13} />
                    کد آشپزخانهٔ تو
                  </div>
                  <button
                    onClick={() => void copyCode()}
                    className="press w-full flex items-center justify-between"
                    style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 16px' }}
                  >
                    <span
                      className="text-sm font-bold"
                      style={{ direction: 'ltr', letterSpacing: 2, color: 'var(--text)' }}
                    >
                      {household.inviteCode}
                    </span>
                    {copied ? (
                      <Check size={16} style={{ color: 'var(--sage)' }} />
                    ) : (
                      <Copy size={16} style={{ color: 'var(--neutral-600)' }} />
                    )}
                  </button>
                </div>

                <div className="text-xs leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
                  {partner
                    ? `شریک تو: ${partner.displayName} — یک انبار، یک لیست خرید، یک دفتر دستورپخت.`
                    : 'فعلاً تنهایی. کد بالا را به یک نفر بده تا آشپزخانه مشترک شود.'}
                </div>

                {!full && (
                  <div className="flex gap-2">
                    <input
                      className="pill-input min-w-0 flex-1"
                      style={{
                        background: 'var(--surface)',
                        border: 'none',
                        direction: 'ltr',
                        textAlign: 'left',
                        fontSize: 13,
                      }}
                      type="text"
                      placeholder="کد آشپزخانهٔ طرف مقابل"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void join()}
                    />
                    <button
                      className="press flex-shrink-0 font-bold"
                      style={{
                        padding: '0 18px',
                        borderRadius: 14,
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: 13,
                      }}
                      onClick={() => void join()}
                      disabled={busy}
                    >
                      وصل شو
                    </button>
                  </div>
                )}

                {full && (
                  <div
                    className="text-xs leading-[1.8]"
                    style={{ background: 'var(--surface)', borderRadius: 14, padding: '11px 14px', color: 'var(--neutral-600)' }}
                  >
                    این آشپزخانه کامل است. برای وصل شدن به کس دیگری، اول از این آشپزخانه جدا شو.
                  </div>
                )}

                {!confirmLeave ? (
                  <button
                    className="press w-full flex items-center justify-center gap-2 text-sm font-semibold"
                    style={{ color: 'var(--accent-700)', padding: '8px 0' }}
                    onClick={() => setConfirmLeave(true)}
                  >
                    <LogOut size={15} />
                    جدا شدن از شریک
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-center leading-[1.8]" style={{ color: 'var(--neutral-600)' }}>
                      از این آشپزخانه جدا می‌شوی و یک کد تازه برای خودت می‌گیری. انبار و
                      دستورهای مشترک پیش شریکت می‌مانند.
                    </div>
                    <button className="btn-danger" onClick={() => void leave()} disabled={busy}>
                      بله، جدا شو
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

                <button
                  className="w-full text-center text-xs py-1"
                  style={{ color: 'var(--neutral-500)' }}
                  onClick={() => void refresh()}
                  disabled={busy}
                >
                  {busy ? <Loader2 size={14} className="animate-spin inline" /> : 'تازه‌سازی از سرور'}
                </button>
              </>
            ) : (
              <button
                className="btn-primary flex items-center justify-center gap-2"
                onClick={() => void refresh()}
                disabled={busy}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                گرفتن کد آشپزخانه
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
