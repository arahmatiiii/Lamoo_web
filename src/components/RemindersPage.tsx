import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { useStore, Reminder } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import { fa } from '../utils/format';

const days = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const dayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const typeEmojis: Record<string, string> = { 'خرید': '🛒', 'پخت': '🍳', 'بررسی': '🔍' };
const typePillStyle: Record<string, { bg: string; color: string }> = {
  'خرید': { bg: '#fff2eb', color: '#8c491a' },
  'پخت': { bg: 'rgba(198,113,57,.16)', color: '#8c491a' },
  'بررسی': { bg: '#f0fae1', color: '#56633f' },
};

export default function RemindersPage() {
  const store = useStore();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const pending = store.reminders.filter((r) => !r.completed);
  const completed = store.reminders.filter((r) => r.completed);

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader kicker="برنامه هفته" headline="یادآورها" />

      <div className="scroll-content space-y-[14px]" style={{ paddingTop: 4 }}>
        {pending.length > 0 && (
          <>
            {pending.map((r) => (
              <ReminderCard key={r.id} reminder={r} onToggle={() => store.toggleReminderComplete(r.id)} onDelete={() => store.removeReminder(r.id)} />
            ))}
          </>
        )}

        {completed.length > 0 && (
          <div style={{ paddingTop: pending.length > 0 ? 8 : 0 }} className="space-y-[14px]">
            <div className="section-label">انجام شده</div>
            {completed.map((r) => (
              <ReminderCard key={r.id} reminder={r} onToggle={() => store.toggleReminderComplete(r.id)} onDelete={() => store.removeReminder(r.id)} isCompleted />
            ))}
          </div>
        )}

        {store.reminders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center rise">
            <div className="medallion mb-3" style={{ width: 64, height: 64, fontSize: 30 }}>🔔</div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>یادآوری ندارید</p>
            <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>با دکمه + یادآور جدید بسازید</p>
          </div>
        )}
      </div>

      <button className="fab press" onClick={() => setShowAddSheet(true)}>
        <Plus size={24} strokeWidth={3} />
      </button>

      {showAddSheet && <AddReminderSheet onClose={() => setShowAddSheet(false)} />}
    </div>
  );
}

function ReminderCard({
  reminder,
  onToggle,
  onDelete,
  isCompleted = false,
}: {
  reminder: Reminder;
  onToggle: () => void;
  onDelete: () => void;
  isCompleted?: boolean;
}) {
  const typeStyle = typePillStyle[reminder.type];
  return (
    <div
      className="flex items-start rise"
      style={{
        borderRadius: 28,
        padding: '18px 20px',
        gap: 15,
        background: isCompleted ? 'var(--surface)' : 'var(--card)',
        opacity: isCompleted ? 0.6 : 1,
        boxShadow: isCompleted ? 'none' : 'var(--shadow-sm)',
      }}
    >
      <button onClick={onToggle} className={`checkbox-circle press flex-shrink-0 ${isCompleted ? 'checked' : ''}`} style={{ marginTop: 1 }}>
        {isCompleted && <Check size={13} strokeWidth={3.5} className="text-white" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="font-bold"
          style={{
            fontSize: 15,
            lineHeight: 1.45,
            color: isCompleted ? 'var(--neutral-600)' : 'var(--text)',
            textDecoration: isCompleted ? 'line-through' : 'none',
          }}
        >
          {reminder.text}
        </div>
        <div className="flex flex-wrap items-center mt-2" style={{ gap: 9 }}>
          <span className="pill" style={{ background: typeStyle.bg, color: typeStyle.color }}>
            {typeEmojis[reminder.type]} {reminder.type}
          </span>
          <span className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            {reminder.day} · {reminder.time}
          </span>
        </div>
      </div>

      <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center flex-shrink-0 press" style={{ color: 'var(--neutral-400)' }}>
        <X size={13} />
      </button>
    </div>
  );
}

function AddReminderSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [text, setText] = useState('');
  const [selectedDay, setSelectedDay] = useState(2);
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [type, setType] = useState<'خرید' | 'پخت' | 'بررسی'>('خرید');

  const handleSave = () => {
    if (!text.trim()) return;
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text,
      day: dayNames[selectedDay],
      time: `${fa(hour)}:${fa(minute).padStart(2, '۰')}`,
      type,
      completed: false,
    };
    store.addReminder(newReminder);
    onClose();
  };

  const adjustHour = (delta: number) => setHour((h) => (h + delta + 24) % 24);
  const adjustMinute = (delta: number) => setMinute((m) => (m + delta + 60) % 60);

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="bottom-sheet-handle" />
        <div className="px-6 pb-8" style={{ paddingTop: 12 }}>
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🔔</span>
            <div>
              <h2 className="font-bold" style={{ fontSize: 20, color: 'var(--text)' }}>یادآور جدید</h2>
              <p className="text-xs" style={{ color: 'var(--neutral-600)' }}>زمان و متن یادآور را وارد کن</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>متن یادآور</div>
              <input className="input-field rounded" placeholder="مثلاً: خرید یک کیلو بامیه" value={text} onChange={(e) => setText(e.target.value)} />
            </div>

            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--neutral-600)' }}>نوع یادآور</div>
              <div className="flex gap-2">
                {(['خرید', 'پخت', 'بررسی'] as const).map((t) => (
                  <button key={t} onClick={() => setType(t)} className={`chip press flex-1 justify-center ${type === t ? 'chip-active' : 'chip-inactive'}`}>
                    {typeEmojis[t]} {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs mb-3" style={{ color: 'var(--neutral-600)' }}>روز هفته</div>
              <div className="flex gap-2 justify-between">
                {days.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(idx)}
                    className="press flex items-center justify-center font-semibold"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      fontSize: 13,
                      background: selectedDay === idx ? 'var(--accent)' : 'var(--surface)',
                      color: selectedDay === idx ? '#fff' : 'var(--neutral-600)',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs mb-3" style={{ color: 'var(--neutral-600)' }}>ساعت</div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => adjustHour(1)} className="text-xl pb-1 press" style={{ color: 'var(--neutral-500)' }}>▲</button>
                  <div className="font-bold text-center" style={{ background: 'var(--surface)', borderRadius: 16, padding: '14px 20px', fontSize: 28, minWidth: 66 }}>
                    {fa(hour)}
                  </div>
                  <button onClick={() => adjustHour(-1)} className="text-xl pt-1 press" style={{ color: 'var(--neutral-500)' }}>▼</button>
                </div>
                <div className="text-2xl font-bold" style={{ color: 'var(--neutral-500)' }}>:</div>
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => adjustMinute(5)} className="text-xl pb-1 press" style={{ color: 'var(--neutral-500)' }}>▲</button>
                  <div className="font-bold text-center" style={{ background: 'var(--surface)', borderRadius: 16, padding: '14px 20px', fontSize: 28, minWidth: 66 }}>
                    {fa(minute).padStart(2, '۰')}
                  </div>
                  <button onClick={() => adjustMinute(-5)} className="text-xl pt-1 press" style={{ color: 'var(--neutral-500)' }}>▼</button>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={handleSave}>
              ذخیره یادآور
            </button>
            <button className="btn-ghost" onClick={onClose}>
              انصراف
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
