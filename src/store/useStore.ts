import { create } from 'zustand';

export type Category = 'همه' | 'گوشت' | 'سبزیجات' | 'لبنیات' | 'غلات' | 'میوه' | 'سایر';
export type DietaryMode = 'حلال' | 'بدون‌گوشت‌خوک' | 'وگان' | 'کتو' | 'بدون‌گلوتن';
export type AllergyType = 'گندم' | 'آجیل' | 'لبنیات' | 'تخم‌مرغ';

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  amount: string;
  unit: string;
  expiryDays: number;
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
  dietaryModes: DietaryMode[];
  allergies: AllergyType[];
  notifyExpiry: boolean;
  notifyWeeklySuggestions: boolean;
  notifyShopping: boolean;
  calorieGoal: number;
  servingCount: number;

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
}

const initialPantryItems: PantryItem[] = [
  { id: '1', name: 'گوشت چرخ‌کرده', category: 'گوشت', amount: '300', unit: 'گ × ۳', expiryDays: 16, emoji: '🥩', available: true },
  { id: '2', name: 'لپه', category: 'غلات', amount: '500', unit: 'گ', expiryDays: 4, emoji: '🫘', available: true },
  { id: '3', name: 'میگو (فریز)', category: 'گوشت', amount: '400', unit: 'گ', expiryDays: 72, emoji: '🦐', available: true },
  { id: '4', name: 'گوجه‌گیلاسی', category: 'سبزیجات', amount: '250', unit: 'گ', expiryDays: 1, emoji: '🍅', available: true },
  { id: '5', name: 'روغن زیتون', category: 'سایر', amount: '750', unit: 'میل', expiryDays: 210, emoji: '🫒', available: true },
  { id: '6', name: 'پنیر فتا', category: 'لبنیات', amount: '200', unit: 'گ', expiryDays: 5, emoji: '🧀', available: true },
  { id: '7', name: 'سبزی مخلوط', category: 'سبزیجات', amount: '100', unit: 'گ', expiryDays: 3, emoji: '🥬', available: false },
  { id: '8', name: 'خیار', category: 'سبزیجات', amount: '1', unit: 'عدد', expiryDays: 5, emoji: '🥒', available: true },
];

const initialRecipes: Recipe[] = [
  {
    id: '1',
    name: 'سالاد یونانی',
    emoji: '🥗',
    calories: 280,
    servings: 2,
    timeMinutes: 10,
    availabilityPercent: 100,
    category: 'سالاد',
    tags: ['سالاد', 'الان‌بیز', 'زیر ۳۰ دق'],
    ingredients: [
      { name: 'گوجه‌فرنگی', available: true },
      { name: 'پنیر فتا', available: true },
      { name: 'زیتون', available: false, substitute: 'زیتون سبز' },
      { name: 'خیار', available: false, substitute: 'خیار درشت' },
      { name: 'روغن زیتون', available: true },
    ],
    steps: [
      'گوجه‌فرنگی و خیار را به قطعات خرد کنید',
      'پنیر فتا را به مکعب‌های کوچک تقسیم کنید',
      'همه مواد را در کاسه بریزید',
      'روغن زیتون، نمک و فلفل اضافه کنید',
      'سرو کنید',
    ],
    usesSoonExpiring: false,
  },
  {
    id: '2',
    name: 'سوپ لپه',
    emoji: '🍲',
    calories: 420,
    servings: 4,
    timeMinutes: 45,
    availabilityPercent: 85,
    category: 'سوپ',
    tags: ['سوپ'],
    ingredients: [
      { name: 'لپه', available: true },
      { name: 'پیاز', available: false },
      { name: 'زردچوبه', available: true },
      { name: 'نمک', available: true },
      { name: 'روغن', available: true },
    ],
    steps: [
      'لپه را از شب قبل خیس کنید',
      'پیاز را تفت دهید',
      'لپه را اضافه کنید و با آب بپزید',
      'ادویه‌جات را اضافه کنید',
      'با بلندر هموژن کنید و سرو نمایید',
    ],
    usesSoonExpiring: true,
  },
  {
    id: '3',
    name: 'کوفته کباب',
    emoji: '🥩',
    calories: 520,
    servings: 3,
    timeMinutes: 30,
    availabilityPercent: 90,
    category: 'کباب',
    tags: ['گوشت'],
    ingredients: [
      { name: 'گوشت چرخ‌کرده', available: true },
      { name: 'پیاز', available: false },
      { name: 'نمک', available: true },
      { name: 'فلفل', available: true },
      { name: 'زعفران', available: false },
    ],
    steps: [
      'گوشت و پیاز رنده‌شده را مخلوط کنید',
      'ادویه اضافه کنید و ورز دهید',
      'روی سیخ بکشید',
      'روی کباب‌پز یا در فر بپزید',
      'با نان یا برنج سرو کنید',
    ],
    usesSoonExpiring: false,
  },
];

const initialReminders: Reminder[] = [
  { id: '1', text: 'خرید یک کیلو بامیه', day: 'دوشنبه', time: '۱۹:۰۰', type: 'خرید', completed: false, urgent: true },
  { id: '2', text: 'پختن لپه قبل از انقضا', day: 'یکشنبه', time: '۱۲:۰۰', type: 'پخت', completed: false },
  { id: '3', text: 'بررسی موجودی یخچال', day: 'جمعه', time: '۱۰:۰۰', type: 'بررسی', completed: false },
  { id: '4', text: 'خرید سبزیجات', day: 'سه‌شنبه', time: '۱۶:۰۰', type: 'خرید', completed: true },
];

const initialShoppingItems: ShoppingItem[] = [
  { id: '1', name: 'سبزی مخلوط', amount: '100', unit: 'گ', emoji: '🥬', purchased: false, addedFrom: 'سالاد میگو' },
  { id: '2', name: 'خیار', amount: '1', unit: 'عدد', emoji: '🥒', purchased: false },
  { id: '3', name: 'پیاز قرمز', amount: '½', unit: 'عدد', emoji: '🧅', purchased: false },
  { id: '4', name: 'کره', amount: '1', unit: 'قالب', emoji: '🧈', purchased: false },
  { id: '5', name: 'گیلاس', amount: '1', unit: 'کیلو', emoji: '🍒', purchased: true },
];

export const useStore = create<AppState>((set) => ({
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
  shoppingMessage: 'مورد برای سالاد میگو اضافه شد',

  userName: 'احمد یلماظ',
  userInitials: 'AY',
  isPremium: false,
  dietaryModes: ['بدون‌گوشت‌خوک'],
  allergies: ['گندم'],
  notifyExpiry: true,
  notifyWeeklySuggestions: true,
  notifyShopping: false,
  calorieGoal: 2100,
  servingCount: 2,

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
}));
