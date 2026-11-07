import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useToast } from './Toast';
import { fetchMe, signIn, signUp } from '../utils/serverApi';

/**
 * Sign in or sign up against the app's main server. Deliberately the smallest
 * account form that works — a handle and a password, no email to verify, because
 * there is no password-reset mail to send from a server with no mail setup.
 */
export default function AccountSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!handle.trim() || !password) {
      showToast('نام کاربری و رمز را پر کن', 'error');
      return;
    }

    setBusy(true);
    try {
      const session =
        mode === 'up'
          ? await signUp(handle, password, displayName || handle)
          : await signIn(handle, password);

      // The account may already belong to a shared kitchen on another device,
      // so ask the server rather than assuming this is a fresh start.
      const me = await fetchMe(session.token).catch(() => null);
      store.setServerSession(session.token, me?.user ?? session.user, me?.household ?? null);
      showToast(mode === 'up' ? 'اکانت ساخته شد' : 'خوش آمدی!');
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="bottom-sheet-overlay" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="bottom-sheet" style={{ zIndex: 61 }}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-base font-extrabold" style={{ color: 'var(--text)' }}>
            {mode === 'up' ? 'ساخت اکانت' : 'ورود به لامو'}
          </div>
          <button className="press" onClick={onClose} aria-label="بستن">
            <X size={20} style={{ color: 'var(--neutral-600)' }} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="pill-input"
            style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left' }}
            type="text"
            autoComplete="username"
            placeholder="نام کاربری (انگلیسی)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
          {mode === 'up' && (
            <input
              className="pill-input"
              style={{ background: 'var(--surface)', border: 'none' }}
              type="text"
              placeholder="اسمی که دوستانت می‌بینند"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className="pill-input"
            style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left' }}
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            placeholder="رمز عبور (حداقل ۸ کاراکتر)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />

          <button className="btn-primary flex items-center justify-center gap-2" onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === 'up' ? 'بساز و وارد شو' : 'ورود'}
          </button>

          <button
            className="w-full text-center text-sm py-1"
            style={{ color: 'var(--accent-700)' }}
            onClick={() => setMode(mode === 'up' ? 'in' : 'up')}
          >
            {mode === 'up' ? 'اکانت دارم، وارد می‌شوم' : 'اکانت ندارم، بسازم'}
          </button>

          <div className="text-xs leading-[1.8]" style={{ color: 'var(--neutral-500)' }}>
            این اکانت روی سرور اصلی لامو ساخته می‌شود. رمزت را جایی نگه‌دار —
            روی سروری که ایمیل ندارد، راهی برای بازیابی رمز نیست.
          </div>
        </div>
      </div>
    </>
  );
}
