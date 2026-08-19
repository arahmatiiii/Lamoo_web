import { House, Box, ChefHat, ShoppingBasket, Bell } from 'lucide-react';
import { useStore } from '../store/useStore';

interface Tab {
  id: string;
  label: string;
  icon: typeof House;
}

// Settings is reached via the header avatar, not a nav tab — five tabs here.
const tabs: Tab[] = [
  { id: 'home', label: 'خانه', icon: House },
  { id: 'pantry', label: 'انبار', icon: Box },
  { id: 'recipes', label: 'دستورپخت', icon: ChefHat },
  { id: 'shopping', label: 'خرید', icon: ShoppingBasket },
  { id: 'reminders', label: 'یادآور', icon: Bell },
];

export default function BottomNav() {
  const store = useStore();
  const pendingReminders = store.reminders.filter((r) => !r.completed).length;
  const shoppingCount = store.shoppingItems.filter((i) => !i.purchased).length;

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const isActive =
          store.activeTab === tab.id || (store.activeTab === 'scanner' && tab.id === 'pantry');
        let badge = 0;
        if (tab.id === 'reminders') badge = pendingReminders;
        if (tab.id === 'shopping') badge = shoppingCount;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => store.setActiveTab(tab.id)}
            className={`nav-tab ${isActive ? 'nav-tab-active' : 'nav-tab-inactive'}`}
          >
            <Icon size={21} strokeWidth={2.75} color={isActive ? '#fff' : '#82796a'} />
            <span className="nav-tab-label">{tab.label}</span>
            {!isActive && badge > 0 && <span className="nav-badge">{badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}
