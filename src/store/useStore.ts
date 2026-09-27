import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isoDateInDays } from '../utils/format';
import { nextOccurrence } from '../utils/schedule';
import { toCollections, SyncState } from '../utils/sync';
import type { ServerAccount, ServerHousehold } from '../utils/serverApi';

export type Category = 'همه' | 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
export type AiProvider = 'gemini' | 'openrouter' | 'anthropic' | 'ollama';
export type DietaryMode = string;
export type AllergyType = string;
export type Theme = 'light' | 'dark';
/**
 * Where shared data lives. `relay` is the end-to-end encrypted Cloudflare relay
 * — nobody, including the relay, can read the fridge, and there are no accounts.
 * `server` is your own Lamoo server: it can read the content, which is the price
 * of a friends feed and of notifications that arrive with the app closed.
 */
export type Backend = 'relay' | 'server';

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  /** Empty string when the user chose not to record an amount */
  amount: string;
  unit: string;
  /**
   * Fixed calendar date (`YYYY-MM-DD`) the item expires on, so the remaining
   * days stay correct as time passes. Undefined when the user recorded none.
   */
  expiryDate?: string;
  emoji: string;
  available: boolean;
}

export interface RecipeIngredient {
  name: string;
  available: boolean;
  substitute?: string;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  calories: number;
  servings: number;
  timeMinutes: number;
  availabilityPercent: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: string[];
  category: string;
  usesSoonExpiring?: boolean;
}

export interface Reminder {
  id: string;
  text: string;
  day: string;
  time: string;
  type: 'خرید' | 'پخت' | 'بررسی';
  completed: boolean;
  urgent?: boolean;
  /**
   * When it is actually due, as epoch milliseconds. `day` and `time` are for
   * reading; only this can be scheduled against, which is what lets the server
   * send a notification while the app is closed.
   */
  dueAt?: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  amount: string;
  unit: string;
  emoji: string;
  purchased: boolean;
  addedFrom?: string;
}

export interface AppState {
  // Navigation
  activeTab: string;
  activeModal: string | null;
  selectedItem: PantryItem | null;
  selectedRecipe: Recipe | null;
  selectedReminder: Reminder | null;

  // Pantry
  pantryItems: PantryItem[];
  pantrySearch: string;
  pantryCategory: Category;
  pantryFilter: string;

  // Recipes
  recipes: Recipe[];
  recipeSearch: string;
  recipeFilter: string;

  // Reminders
  reminders: Reminder[];

  // Shopping
  shoppingItems: ShoppingItem[];
  shoppingMessage: string;

  // Settings
  userName: string;
  userInitials: string;
  isPremium: boolean;
  theme: Theme;
  dietaryModes: DietaryMode[];
  allergies: AllergyType[];
  notifyExpiry: boolean;
  notifyWeeklySuggestions: boolean;
  notifyShopping: boolean;
  calorieGoal: number;
  servingCount: number;
  anthropicApiKey: string;
  geminiApiKey: string;
  openrouterApiKey: string;
  ollamaApiKey: string;
  ollamaModel: string;
  /** Cloudflare Worker (or similar) proxy URL — Ollama Cloud's API has no CORS headers */
  ollamaProxyUrl: string;
  aiProvider: AiProvider;

  // Shared household. An empty secret means "just me on this device".
  backend: Backend;
  householdSecret: string;
  householdRelayUrl: string;
  /** Your own Lamoo server, used when `backend` is `server`. */
  serverUrl: string;
  authToken: string;
  account: ServerAccount | null;
  serverHousehold: ServerHousehold | null;
  /** Whether this device has handed the server a Web Push subscription. */
  pushEnabled: boolean;
  /** Flat, tombstoned mirror of the shared collections — see utils/sync.ts */
  syncState: SyncState;
  /** Highest relay sequence number already folded in. */
  syncCursor: number;
  syncStatus: 'off' | 'connecting' | 'live' | 'error';

  // AI Search
  aiQuery: string;
  aiResult: any | null;
  aiLoading: boolean;

  // Scanner
  scannerResult: any | null;

  // Actions
  setActiveTab: (tab: string) => void;
  setActiveModal: (modal: string | null) => void;
  setSelectedItem: (item: PantryItem | null) => void;
  setSelectedRecipe: (recipe: Recipe | null) => void;
  setSelectedReminder: (reminder: Reminder | null) => void;

  setPantrySearch: (q: string) => void;
  setPantryCategory: (cat: Category) => void;
  setPantryFilter: (f: string) => void;
  addPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  updatePantryItem: (id: string, updates: Partial<PantryItem>) => void;

  setRecipeSearch: (q: string) => void;
  setRecipeFilter: (f: string) => void;
  addRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;

  addReminder: (reminder: Reminder) => void;
  toggleReminderComplete: (id: string) => void;
  removeReminder: (id: string) => void;

  addShoppingItem: (item: ShoppingItem) => void;
  toggleShoppingItem: (id: string) => void;
  /**
   * Mark a shopping item bought and stock it in the pantry (restocking a
   * matching item when there is one). Returns false if it was already bought.
   */
  purchaseShoppingItem: (id: string) => boolean;
  /** Mark the named pantry items used up. Returns the ids changed, for undo. */
  consumePantryItems: (names: string[]) => string[];
  /** Put back items emptied by a cook — the undo half of consumePantryItems. */
  restorePantryItems: (ids: string[]) => void;
  removeShoppingItem: (id: string) => void;
  clearPurchasedItems: () => void;
  setShoppingMessage: (msg: string) => void;

  setAiQuery: (q: string) => void;
  setAiResult: (r: any) => void;
  setAiLoading: (l: boolean) => void;
  setScannerResult: (r: any) => void;

  toggleDietaryMode: (mode: DietaryMode) => void;
  toggleAllergy: (allergy: AllergyType) => void;
  setNotifyExpiry: (v: boolean) => void;
  setNotifyWeeklySuggestions: (v: boolean) => void;
  setNotifyShopping: (v: boolean) => void;
  setCalorieGoal: (v: number) => void;
  setServingCount: (v: number) => void;
  setAnthropicApiKey: (key: string) => void;
  setGeminiApiKey: (key: string) => void;
  setOpenrouterApiKey: (key: string) => void;
  setOllamaApiKey: (key: string) => void;
  setOllamaModel: (model: string) => void;
  setOllamaProxyUrl: (url: string) => void;
  setAiProvider: (p: AiProvider) => void;
  joinHousehold: (secret: string, relayUrl: string) => void;
  leaveHousehold: () => void;
  setBackend: (backend: Backend) => void;
  setServerUrl: (url: string) => void;
  /** Signing in adopts the server's copy of the household, so start sync clean. */
  setServerSession: (token: string, account: ServerAccount, household: ServerHousehold | null) => void;
  setServerHousehold: (household: ServerHousehold | null) => void;
  clearServerSession: () => void;
  setPushEnabled: (enabled: boolean) => void;
  setSyncStatus: (status: AppState['syncStatus']) => void;
  /** Replace the shared collections wholesale after a merge. */
  applySync: (state: SyncState, cursor: number) => void;
  setUserProfile: (name: string, initials: string) => void;
  setTheme: (theme: Theme) => void;
}

const initialPantryItems: PantryItem[] = [];
const initialRecipes: Recipe[] = [];
const initialReminders: Reminder[] = [];
const initialShoppingItems: ShoppingItem[] = [];

type LegacyPantryItem = Omit<PantryItem, 'expiryDate'> & { expiryDays?: number; expiryDate?: string };

interface LegacyState {
  pantryItems?: LegacyPantryItem[];
  reminders?: Reminder[];
}

/**
 * v1 → v2: `expiryDays` was a countdown that silently drifted as days passed —
 * an item saved as "3 days left" still claimed 3 days a week later. Anchor it
 * to a real date from the day of the upgrade, which is the best information
 * available after the fact.
 *
 * v2 → v3: reminders had only a Persian weekday name and clock time, which can
 * be read but not scheduled against. Derive the next matching instant so old
 * reminders can send notifications too, rather than silently never firing.
 */
export function migratePersistedState(persisted: unknown, version: number): unknown {
  let state = persisted as LegacyState | null;
  if (!state) return state;

  if (version < 2 && Array.isArray(state.pantryItems)) {
    state = {
      ...state,
      pantryItems: state.pantryItems.map(({ expiryDays, ...item }) => ({
        ...item,
        expiryDate: typeof expiryDays === 'number' ? isoDateInDays(expiryDays) : item.expiryDate,
      })),
    };
  }

  if (version < 3 && Array.isArray(state.reminders)) {
    state = {
      ...state,
      reminders: state.reminders.map((reminder) =>
        reminder.dueAt === undefined
          ? { ...reminder, dueAt: nextOccurrence(reminder.day, reminder.time) }
          : reminder
      ),
    };
  }

  return state;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  activeTab: 'home',
  activeModal: null,
  selectedItem: null,
  selectedRecipe: null,
  selectedReminder: null,

  pantryItems: initialPantryItems,
  pantrySearch: '',
  pantryCategory: 'همه',
  pantryFilter: 'همه',

  recipes: initialRecipes,
  recipeSearch: '',
  recipeFilter: 'همه',

  reminders: initialReminders,

  shoppingItems: initialShoppingItems,
  shoppingMessage: '',

  userName: '',
  userInitials: '',
  isPremium: false,
  theme: 'light',
  dietaryModes: [],
  allergies: [],
  notifyExpiry: true,
  notifyWeeklySuggestions: true,
  notifyShopping: false,
  calorieGoal: 2100,
  servingCount: 2,
  anthropicApiKey: '',
  geminiApiKey: '',
  openrouterApiKey: '',
  ollamaApiKey: '',
  ollamaModel: 'gpt-oss:20b-cloud',
  ollamaProxyUrl: '',
  // Default to the free tier for the testing phase
  aiProvider: 'gemini' as AiProvider,

  backend: 'server' as Backend,
  householdSecret: '',
  householdRelayUrl: '',
  serverUrl: '',
  authToken: '',
  account: null,
  serverHousehold: null,
  pushEnabled: false,
  syncState: {},
  syncCursor: 0,
  syncStatus: 'off' as AppState['syncStatus'],

  aiQuery: '',
  aiResult: null,
  aiLoading: false,
  scannerResult: null,

  setActiveTab: (tab) => set({ activeTab: tab, activeModal: null }),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setSelectedRecipe: (recipe) => set({ selectedRecipe: recipe }),
  setSelectedReminder: (reminder) => set({ selectedReminder: reminder }),

  setPantrySearch: (q) => set({ pantrySearch: q }),
  setPantryCategory: (cat) => set({ pantryCategory: cat }),
  setPantryFilter: (f) => set({ pantryFilter: f }),
  addPantryItem: (item) => set((s) => ({ pantryItems: [...s.pantryItems, item] })),
  removePantryItem: (id) => set((s) => ({ pantryItems: s.pantryItems.filter((i) => i.id !== id) })),
  updatePantryItem: (id, updates) =>
    set((s) => ({ pantryItems: s.pantryItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),

  setRecipeSearch: (q) => set({ recipeSearch: q }),
  setRecipeFilter: (f) => set({ recipeFilter: f }),
  addRecipe: (recipe) => set((s) => ({ recipes: [recipe, ...s.recipes] })),
  removeRecipe: (id) => set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

  addReminder: (reminder) => set((s) => ({ reminders: [reminder, ...s.reminders] })),
  toggleReminderComplete: (id) =>
    set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)) })),
  removeReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),

  addShoppingItem: (item) => set((s) => ({ shoppingItems: [...s.shoppingItems, item] })),
  toggleShoppingItem: (id) =>
    set((s) => ({ shoppingItems: s.shoppingItems.map((i) => (i.id === id ? { ...i, purchased: !i.purchased } : i)) })),

  purchaseShoppingItem: (id) => {
    const s = get();
    const item = s.shoppingItems.find((i) => i.id === id);
    if (!item || item.purchased) return false;

    const existing = s.pantryItems.find((p) => p.name === item.name);
    set((prev) => ({
      shoppingItems: prev.shoppingItems.map((i) => (i.id === id ? { ...i, purchased: true } : i)),
      pantryItems: existing
        ? prev.pantryItems.map((p) =>
            p.id === existing.id ? { ...p, available: true, amount: item.amount, unit: item.unit } : p
          )
        : [
            ...prev.pantryItems,
            {
              id: `${Date.now()}-${item.id}`,
              name: item.name,
              category: 'سایر' as Category,
              amount: item.amount,
              unit: item.unit,
              emoji: item.emoji,
              available: true,
            },
          ],
    }));
    return true;
  },

  consumePantryItems: (names) => {
    const available = get().pantryItems.filter((p) => p.available);
    const ids = new Set<string>();
    names.forEach((raw) => {
      const n = raw.trim();
      if (!n) return;
      const match = available.find(
        (p) => !ids.has(p.id) && (p.name.includes(n) || n.includes(p.name.split('(')[0].trim()))
      );
      if (match) ids.add(match.id);
    });
    if (ids.size === 0) return [];
    set((s) => ({
      pantryItems: s.pantryItems.map((p) => (ids.has(p.id) ? { ...p, available: false } : p)),
    }));
    return [...ids];
  },

  restorePantryItems: (ids) =>
    set((s) => ({
      pantryItems: s.pantryItems.map((p) => (ids.includes(p.id) ? { ...p, available: true } : p)),
    })),
  removeShoppingItem: (id) => set((s) => ({ shoppingItems: s.shoppingItems.filter((i) => i.id !== id) })),
  clearPurchasedItems: () => set((s) => ({ shoppingItems: s.shoppingItems.filter((i) => !i.purchased) })),
  setShoppingMessage: (msg) => set({ shoppingMessage: msg }),

  setAiQuery: (q) => set({ aiQuery: q }),
  setAiResult: (r) => set({ aiResult: r }),
  setAiLoading: (l) => set({ aiLoading: l }),
  setScannerResult: (r) => set({ scannerResult: r }),

  toggleDietaryMode: (mode) =>
    set((s) => ({
      dietaryModes: s.dietaryModes.includes(mode)
        ? s.dietaryModes.filter((d) => d !== mode)
        : [...s.dietaryModes, mode],
    })),
  toggleAllergy: (allergy) =>
    set((s) => ({
      allergies: s.allergies.includes(allergy)
        ? s.allergies.filter((a) => a !== allergy)
        : [...s.allergies, allergy],
    })),
  setNotifyExpiry: (v) => set({ notifyExpiry: v }),
  setNotifyWeeklySuggestions: (v) => set({ notifyWeeklySuggestions: v }),
  setNotifyShopping: (v) => set({ notifyShopping: v }),
  setCalorieGoal: (v) => set({ calorieGoal: v }),
  setServingCount: (v) => set({ servingCount: v }),
  setAnthropicApiKey: (key) => set({ anthropicApiKey: key }),
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),
  setOpenrouterApiKey: (key) => set({ openrouterApiKey: key }),
  setOllamaApiKey: (key) => set({ ollamaApiKey: key }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaProxyUrl: (url) => set({ ollamaProxyUrl: url }),
  setAiProvider: (p) => set({ aiProvider: p }),

  joinHousehold: (secret, relayUrl) =>
    // Start from a clean slate: whatever this device knew is re-published
    // from scratch, and the household's own history arrives from the relay.
    set({ householdSecret: secret, householdRelayUrl: relayUrl, syncState: {}, syncCursor: 0 }),
  leaveHousehold: () =>
    set({ householdSecret: '', householdRelayUrl: '', syncState: {}, syncCursor: 0, syncStatus: 'off' }),
  setBackend: (backend) => set({ backend, syncState: {}, syncCursor: 0, syncStatus: 'off' }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setServerSession: (authToken, account, serverHousehold) =>
    set({ authToken, account, serverHousehold, syncState: {}, syncCursor: 0, syncStatus: 'off' }),
  setServerHousehold: (serverHousehold) =>
    set((s) => ({
      serverHousehold,
      account: s.account ? { ...s.account, householdId: serverHousehold?.id ?? null } : s.account,
      // Moving between households means none of the old row history applies.
      syncState: {},
      syncCursor: 0,
    })),
  clearServerSession: () =>
    set({
      authToken: '',
      account: null,
      serverHousehold: null,
      pushEnabled: false,
      syncState: {},
      syncCursor: 0,
      syncStatus: 'off',
    }),
  setPushEnabled: (pushEnabled) => set({ pushEnabled }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  applySync: (syncState, syncCursor) => {
    const collections = toCollections(syncState);
    set({
      syncState,
      syncCursor,
      pantryItems: collections.pantry as PantryItem[],
      recipes: collections.recipe as Recipe[],
      shoppingItems: collections.shopping as ShoppingItem[],
      reminders: collections.reminder as Reminder[],
    });
  },
  setUserProfile: (name, initials) => set({ userName: name, userInitials: initials }),
  setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ashpazkhane-store',
      version: 3,
      migrate: (persisted, version) => migratePersistedState(persisted, version) as AppState,
      // Persist only user data — not transient UI state like the active tab,
      // open modals, search text, or in-flight AI results.
      partialize: (s) => ({
        pantryItems: s.pantryItems,
        recipes: s.recipes,
        reminders: s.reminders,
        shoppingItems: s.shoppingItems,
        userName: s.userName,
        userInitials: s.userInitials,
        isPremium: s.isPremium,
        theme: s.theme,
        dietaryModes: s.dietaryModes,
        allergies: s.allergies,
        notifyExpiry: s.notifyExpiry,
        notifyWeeklySuggestions: s.notifyWeeklySuggestions,
        notifyShopping: s.notifyShopping,
        calorieGoal: s.calorieGoal,
        servingCount: s.servingCount,
        anthropicApiKey: s.anthropicApiKey,
        geminiApiKey: s.geminiApiKey,
        openrouterApiKey: s.openrouterApiKey,
        ollamaApiKey: s.ollamaApiKey,
        ollamaModel: s.ollamaModel,
        ollamaProxyUrl: s.ollamaProxyUrl,
        aiProvider: s.aiProvider,
        backend: s.backend,
        householdSecret: s.householdSecret,
        householdRelayUrl: s.householdRelayUrl,
        serverUrl: s.serverUrl,
        authToken: s.authToken,
        account: s.account,
        serverHousehold: s.serverHousehold,
        pushEnabled: s.pushEnabled,
        // Tombstones have to survive a restart, or a deleted item would come
        // back the next time the other phone syncs.
        syncState: s.syncState,
        syncCursor: s.syncCursor,
      }),
    }
  )
);
