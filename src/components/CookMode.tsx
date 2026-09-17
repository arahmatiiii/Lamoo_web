import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react';
import type { Recipe } from '../store/useStore';
import { fa } from '../utils/format';
import { parseStepMinutes, formatClock } from '../utils/cook';

/**
 * Keep the screen on while cooking — hands are covered in flour and nobody
 * wants to tap the phone every 30 seconds. Silently does nothing where the
 * Wake Lock API is unavailable (Safari on older iOS, insecure origins).
 */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen');
      } catch {
        /* denied or unsupported — cooking still works, the screen just dims */
      }
    };

    // The lock drops whenever the tab is hidden, so re-take it on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}

function StepTimer({ minutes }: { minutes: number }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const [running, setRunning] = useState(false);
  const doneRef = useRef(false);

  // Reset when the cook moves to a different step.
  useEffect(() => {
    setRemaining(minutes * 60);
    setRunning(false);
    doneRef.current = false;
  }, [minutes]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          setRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const finished = remaining === 0;
  if (finished && !doneRef.current) {
    doneRef.current = true;
    navigator.vibrate?.([200, 100, 200]);
  }

  return (
    <div
      className="flex items-center justify-between"
      style={{
        background: finished ? 'var(--sage-100)' : 'var(--card)',
        borderRadius: 24,
        padding: '14px 18px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => (finished ? setRemaining(minutes * 60) : setRunning((r) => !r))}
          className="press flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 44, height: 44, background: finished ? 'var(--sage)' : 'var(--accent)' }}
          aria-label={finished ? 'شروع دوباره' : running ? 'مکث' : 'شروع تایمر'}
        >
          {finished ? (
            <RotateCcw size={18} className="text-white" strokeWidth={2.5} />
          ) : running ? (
            <Pause size={18} className="text-white" strokeWidth={2.5} />
          ) : (
            <Play size={18} className="text-white" strokeWidth={2.5} />
          )}
        </button>
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: 26, color: finished ? 'var(--sage-700)' : 'var(--text)', direction: 'ltr' }}
        >
          {formatClock(remaining)}
        </span>
      </div>
      <span className="text-xs font-semibold" style={{ color: finished ? 'var(--sage-700)' : 'var(--neutral-600)' }}>
        {finished ? 'وقتشه! ✅' : `تایمر ${fa(minutes)} دقیقه‌ای`}
      </span>
    </div>
  );
}

/**
 * One step at a time, in large type — the opposite of scanning a wall of text
 * with sticky fingers.
 */
export default function CookMode({
  recipe,
  onClose,
  onFinish,
}: {
  recipe: Recipe;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  useWakeLock(true);

  const steps = recipe.steps;
  const step = steps[index] ?? '';
  const minutes = parseStepMinutes(step);
  const isLast = index >= steps.length - 1;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--bg)', zIndex: 80, direction: 'rtl' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6" style={{ paddingTop: 'calc(18px + env(safe-area-inset-top, 0px))' }}>
        <div className="min-w-0">
          <div className="text-xs font-bold" style={{ color: 'var(--accent-700)' }}>در حال پخت</div>
          <div className="font-bold truncate" style={{ fontSize: 19, color: 'var(--text)' }}>{recipe.name}</div>
        </div>
        <button onClick={onClose} className="sheet-close press flex-shrink-0" aria-label="بستن">
          <X size={17} />
        </button>
      </div>

      {/* Progress */}
      <div className="flex gap-1.5 px-6" style={{ marginTop: 16 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i <= index ? 'var(--accent)' : 'var(--neutral-300)',
              transition: 'background .25s ease',
            }}
          />
        ))}
      </div>

      {/* The step itself */}
      <div className="flex-1 flex flex-col justify-center px-6" style={{ gap: 22, overflowY: 'auto' }}>
        <div className="text-sm font-bold" style={{ color: 'var(--accent-700)' }}>
          مرحله {fa(index + 1)} از {fa(steps.length)}
        </div>
        <p
          className="font-bold"
          style={{ fontSize: 27, lineHeight: 1.75, color: 'var(--text)' }}
        >
          {step}
        </p>
        {minutes != null && <StepTimer minutes={minutes} />}
      </div>

      {/* Controls */}
      <div
        className="px-6 flex items-center gap-3"
        style={{ paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', paddingTop: 12 }}
      >
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="press flex items-center justify-center rounded-full flex-shrink-0"
          style={{
            width: 52,
            height: 52,
            background: 'var(--card)',
            opacity: index === 0 ? 0.4 : 1,
            boxShadow: 'var(--shadow-sm)',
          }}
          aria-label="مرحله قبل"
        >
          <ChevronRight size={22} style={{ color: 'var(--neutral-700)' }} />
        </button>

        {isLast ? (
          <button className="btn-primary flex-1" onClick={onFinish}>
            تموم شد ✅
          </button>
        ) : (
          <button
            className="btn-primary flex-1 flex items-center justify-center gap-1"
            onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
          >
            مرحله بعد
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
