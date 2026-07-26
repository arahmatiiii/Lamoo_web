import { useEffect, useState } from 'react';
import { useStore } from './store/useStore';
import SplashScreen from './components/SplashScreen';
import BottomNav from './components/BottomNav';
import HomePage from './components/HomePage';
import PantryPage from './components/PantryPage';
import RecipesPage from './components/RecipesPage';
import RemindersPage from './components/RemindersPage';
import ShoppingPage from './components/ShoppingPage';
import SettingsPage from './components/SettingsPage';
import ScannerPage from './components/ScannerPage';
import RecipeDetailSheet from './components/RecipeDetailSheet';

function PageContent() {
  const store = useStore();

  switch (store.activeTab) {
    case 'home': return <HomePage />;
    case 'pantry': return <PantryPage />;
    case 'scanner': return <ScannerPage />;
    case 'recipes': return <RecipesPage />;
    case 'reminders': return <RemindersPage />;
    case 'shopping': return <ShoppingPage />;
    case 'settings': return <SettingsPage />;
    default: return <HomePage />;
  }
}

export default function App() {
  const store = useStore();
  const [showSplash, setShowSplash] = useState(true);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('sw.js')
        .catch(() => {/* offline support not available */});
    }
    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
  }, []);

  const isScanner = store.activeTab === 'scanner';

  // Show global recipe detail modal (triggered from home page)
  const showGlobalRecipeModal =
    store.activeModal === 'recipeDetail' &&
    store.selectedRecipe !== null &&
    store.activeTab === 'home';

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <div
      id="app-shell"
      className="flex flex-col"
      style={{ height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}
    >
      {/* Page content */}
      <div
        className="flex-1 overflow-hidden page-enter"
        style={{ display: 'flex', flexDirection: 'column' }}
        key={store.activeTab}
      >
        <PageContent />
      </div>

      {/* Bottom Navigation - hidden in scanner */}
      {!isScanner && <BottomNav />}

      {/* Global Recipe Modal (from home page) */}
      {showGlobalRecipeModal && store.selectedRecipe && (
        <RecipeDetailSheet
          recipe={store.selectedRecipe}
          onClose={() => {
            store.setActiveModal(null);
            store.setSelectedRecipe(null);
          }}
        />
      )}
    </div>
  );
}
