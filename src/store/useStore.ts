import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Category = 'همه' | 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
export type AiProvider = 'gemini' | 'openrouter' | 'anthropic' | 'ollama';
export type DietaryMode = string;
export type AllergyType = string;
export type Theme = 'light' | 'dark';

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  /** Empty string when the user chose not to record an amount */
  amount: string;
  unit: string;
  /** Undefined when the user chose not to record an expiry date */
  expiryDays?: number;
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
  setUserProfile: (name: string, initials: string) => void;
  setTheme: (theme: Theme) => void;
}

const initialPantryItems: PantryItem[] = [];
const initialRecipes: Recipe[] = [];
const initialReminders: Reminder[] = [];
const initialShoppingItems: ShoppingItem[] = [];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
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
  setUserProfile: (name, initials) => set({ userName: name, userInitials: initials }),
  setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ashpazkhane-store',
      version: 1,
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
      }),
    }
  )
);
