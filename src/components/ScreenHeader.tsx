import { Bell } from 'lucide-react';
import { useStore } from '../store/useStore';

/**
 * Shared per-screen header: kicker + headline on the right, bell (→
 * reminders) and avatar (→ settings) on the left. Settings is reached only
 * through the avatar — it is not one of the floating nav's five tabs.
 */
export default function ScreenHeader({
  kicker,
  headline,
  hideActions = false,
}: {
  kicker: string;
  headline: string;
  hideActions?: boolean;
}) {
  const store = useStore();
  const pendingReminders = store.reminders.filter((r) => !r.completed).length;

  return (
    <div className="screen-header">
      <div className="min-w-0">
        <div className="header-kicker">{kicker}</div>
        <div className="header-headline">{headline}</div>
      </div>
      {!hideActions && (
        <div className="header-actions">
          <button className="icon-btn press" onClick={() => store.setActiveTab('reminders')}>
            <Bell size={19} strokeWidth={2.5} />
            {pendingReminders > 0 && <span className="icon-btn-badge">{pendingReminders}</span>}
          </button>
          <button className="avatar-btn press" onClick={() => store.setActiveTab('settings')}>
            {store.userInitials}
          </button>
        </div>
      )}
    </div>
  );
}
