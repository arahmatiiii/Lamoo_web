import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useStore, Reminder } from '../store/useStore';

const days = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const dayNames = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const typeEmojis: Record<string, string> = {
  'خرید': '🛒',
  'پخت': '🍳',
  'بررسی': '🔍',
};

const typeColors: Record<string, string> = {
  'خرید': '#3b82f6',
  'پخت': '#f59e0b',
  'بررسی': '#8b5cf6',
};

export default function RemindersPage() {
  const store = useStore();
  const [showAddSheet, setShowAddSheet] = useState(false);

  const pending = store.reminders.filter((r) => !r.completed);
  const completed = store.reminders.filter((r) => r.completed);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="app-header">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">یادآورها</span>
          <span className="text-2xl">🔔</span>
        </div>
      </div>

      <div className="scroll-content px-4 pb-4 space-y-4">
        {/* Notification status */}
        <div className="alert-banner alert-success">
          <span>✅</span>
          <span className="font-semibold">اعلان‌ها فعال است</span>
        </div>

        {/* Pending */}
        {pending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
              <span>⏳</span>
              <span>پیش رو</span>
            </div>
            <div className="space-y-3">
              {pending.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onToggle={() => store.toggleReminderComplete(r.id)}
                  onDelete={() => store.removeReminder(r.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
              <span>✅</span>
              <span>انجام شده</span>
            </div>
            <div className="space-y-3">
              {completed.map((r) => (
                <ReminderCard
                  key={r.id}
                  reminder={r}
                  onToggle={() => store.toggleReminderComplete(r.id)}
                  onDelete={() => store.removeReminder(r.id)}
                  isCompleted
                />
              ))}
            </div>
          </div>
        )}

        {store.reminders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <span className="text-5xl mb-3">🔔</span>
            <p className="text-sm">یادآوری ندارید</p>
            <p className="text-xs mt-1">با دکمه + یادآور جدید بسازید</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowAddSheet(true)}>
        <Plus size={24} />
      </button>

      {/* Add Reminder Sheet */}
      {showAddSheet && (
        <AddReminderSheet onClose={() => setShowAddSheet(false)} />
      )}
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
  return (
    <div
      className="card flex items-center gap-3"
      style={{
        opacity: isCompleted ? 0.6 : 1,
        background: reminder.urgent && !isCompleted ? 'rgba(245,158,11,0.08)' : '#1f2937',
        border: reminder.urgent && !isCompleted ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className={`custom-checkbox ${isCompleted ? 'checked' : ''}`}
        style={{
          borderColor: isCompleted ? '#10b981' : '#374151',
        }}
      >
        {isCompleted && <span className="text-black text-xs font-bold">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${isCompleted ? 'line-through text-gray-500' : 'text-white'}`}>
          {reminder.text}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-2 py-0.5 rounded-md font-semibold"
            style={{
              background: `${typeColors[reminder.type]}20`,
              color: typeColors[reminder.type],
            }}
          >
            {typeEmojis[reminder.type]} {reminder.type}
          </span>
          <span className="text-xs text-gray-500">📅 {reminder.day}</span>
          <span className="text-xs text-gray-500">⏰ {reminder.time}</span>
          {reminder.urgent && !isCompleted && (
            <span className="text-xs px-2 py-0.5 rounded-md font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
              دقیقه ۴۰
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddReminderSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [text, setText] = useState('');
  const [selectedDay, setSelectedDay] = useState(2); // Wednesday
  const [hour, setHour] = useState(19);
  const [minute, setMinute] = useState(0);
  const [type, setType] = useState<'خرید' | 'پخت' | 'بررسی'>('خرید');

  const handleSave = () => {
    if (!text.trim()) return;
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text,
      day: dayNames[selectedDay],
      time: `${toPersianNum(hour)}:${toPersianNum(minute).padStart(2, '۰')}`,
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

        <div className="px-5 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div>
              <h2 className="text-lg font-bold text-white">یادآور جدید</h2>
              <p className="text-xs text-gray-400">زمان و متن یادآور را وارد کن</p>
            </div>
          </div>

          {/* Text */}
          <div>
            <div className="text-xs text-gray-400 mb-2">متن یادآور</div>
            <input
              className="input-field"
              placeholder="مثلاً: خرید یک کیلو بامیه"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {/* Type */}
          <div>
            <div className="text-xs text-gray-400 mb-2">نوع یادآور</div>
            <div className="flex gap-2">
              {(['خرید', 'پخت', 'بررسی'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`chip flex-1 ${type === t ? 'chip-active' : 'chip-inactive'}`}
                >
                  {typeEmojis[t]} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Day selector */}
          <div>
            <div className="text-xs text-gray-400 mb-3">روز هفته</div>
            <div className="flex gap-2 justify-between">
              {days.map((d, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedDay(idx)}
                  className={`day-btn ${selectedDay === idx ? 'day-btn-active' : 'day-btn-inactive'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Time picker */}
          <div>
            <div className="text-xs text-gray-400 mb-3">ساعت</div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => adjustHour(1)} className="text-gray-400 text-xl pb-1">▲</button>
                <div className="time-box">{toPersianNum(hour)}</div>
                <button onClick={() => adjustHour(-1)} className="text-gray-400 text-xl pt-1">▼</button>
              </div>
              <div className="text-2xl font-bold text-gray-400">:</div>
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => adjustMinute(5)} className="text-gray-400 text-xl pb-1">▲</button>
                <div className="time-box">{toPersianNum(minute).padStart(2, '۰')}</div>
                <button onClick={() => adjustMinute(-5)} className="text-gray-400 text-xl pt-1">▼</button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <button className="btn-primary" onClick={handleSave}>
            💾 ذخیره یادآور
          </button>
          <button
            className="w-full text-center text-gray-400 text-sm py-2"
            onClick={onClose}
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

function toPersianNum(n: number): string {
  return n.toString().replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}
