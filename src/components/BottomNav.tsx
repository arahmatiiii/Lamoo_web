import React from 'react';
import { useStore } from '../store/useStore';

interface Tab {
  id: string;
  label: string;
  icon: (active: boolean) => React.ReactElement;
}

const HomeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#10b981' : 'none'} stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
);

const PantryIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

const RecipeIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const BellIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#10b981' : 'none'} stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const CartIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <circle cx="9" cy="21" r="1"/>
    <circle cx="20" cy="21" r="1"/>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
  </svg>
);

const GearIcon = ({ active }: { active: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#10b981' : '#6b7280'} strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const tabs: Tab[] = [
  { id: 'home', label: 'خانه', icon: (a) => <HomeIcon active={a} /> },
  { id: 'pantry', label: 'انبار', icon: (a) => <PantryIcon active={a} /> },
  { id: 'recipes', label: 'دستوریخت', icon: (a) => <RecipeIcon active={a} /> },
  { id: 'reminders', label: 'یادآور', icon: (a) => <BellIcon active={a} /> },
  { id: 'shopping', label: 'خرید', icon: (a) => <CartIcon active={a} /> },
  { id: 'settings', label: 'تنظیمات', icon: (a) => <GearIcon active={a} /> },
];

export default function BottomNav() {
  const store = useStore();
  const pendingReminders = store.reminders.filter((r) => !r.completed).length;
  const shoppingCount = store.shoppingItems.filter((i) => !i.purchased).length;

  return (
    <nav className="nav-bar flex-shrink-0 safe-area-pb">
      <div className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {tabs.map((tab) => {
          const isActive = store.activeTab === tab.id ||
            (store.activeTab === 'scanner' && tab.id === 'pantry');
          let badge = 0;
          if (tab.id === 'reminders') badge = pendingReminders;
          if (tab.id === 'shopping') badge = shoppingCount;

          return (
            <button
              key={tab.id}
              onClick={() => store.setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center flex-1 py-2.5 relative"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                minHeight: '56px',
              }}
            >
              {/* Active pill background */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '40px',
                    height: '32px',
                    background: 'rgba(16,185,129,0.1)',
                    borderRadius: '10px',
                  }}
                />
              )}

              <div className="relative">
                {tab.icon(isActive)}
                {badge > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '7px',
                      background: '#ef4444',
                      color: 'white',
                      fontSize: '9px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                    }}
                  >
                    {badge}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: '10px',
                  marginTop: '3px',
                  fontFamily: 'Vazirmatn, sans-serif',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#10b981' : '#6b7280',
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
