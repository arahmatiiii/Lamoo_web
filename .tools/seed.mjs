const day = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
};

const pantry = [
  { id: 'p1', name: 'تخم‌مرغ', category: 'سایر', amount: '۱۲', unit: 'عدد', expiryDate: day(2), emoji: '🥚', available: true },
  { id: 'p2', name: 'شیر', category: 'لبنیات', amount: '۱', unit: 'لیتر', expiryDate: day(1), emoji: '🥛', available: true },
  { id: 'p3', name: 'گوجه‌فرنگی', category: 'سبزیجات', amount: '۵۰۰', unit: 'گرم', expiryDate: day(3), emoji: '🍅', available: true },
  { id: 'p4', name: 'پیاز', category: 'سبزیجات', amount: '۲', unit: 'کیلوگرم', expiryDate: day(24), emoji: '🧅', available: true },
  { id: 'p5', name: 'برنج', category: 'غلات', amount: '۱', unit: 'کیلوگرم', expiryDate: day(180), emoji: '🍚', available: true },
  { id: 'p6', name: 'ماست', category: 'لبنیات', amount: '۵۰۰', unit: 'گرم', expiryDate: day(6), emoji: '🥣', available: true },
  { id: 'p7', name: 'مرغ', category: 'گوشت', amount: '۷۰۰', unit: 'گرم', expiryDate: day(1), emoji: '🍗', available: true },
  { id: 'p8', name: 'سبزی خوردن', category: 'سبزیجات', amount: '۱', unit: 'بسته', expiryDate: day(2), emoji: '🌿', available: true },
  { id: 'p9', name: 'لیمو', category: 'میوه', amount: '۴', unit: 'عدد', expiryDate: day(11), emoji: '🍋', available: true },
  { id: 'p10', name: 'سیب', category: 'میوه', amount: '۶', unit: 'عدد', expiryDate: day(19), emoji: '🍎', available: true },
  { id: 'p11', name: 'عدس', category: 'غلات', amount: '', unit: 'عدد', available: false, emoji: '🥫' },
  { id: 'p12', name: 'زردچوبه', category: 'سایر', amount: '۲۰۰', unit: 'گرم', expiryDate: day(300), emoji: '🫙', available: true },
];

const recipes = [
  {
    id: 'r1', name: 'کوکوی سبزی', emoji: '🍳', calories: 320, servings: 2, timeMinutes: 20,
    availabilityPercent: 80, category: 'سایر', tags: ['الان‌بیز', 'زیر ۳۰ دق'], usesSoonExpiring: true,
    ingredients: [
      { name: 'سبزی خوردن', available: true },
      { name: 'تخم‌مرغ', available: true },
      { name: 'پیاز', available: true },
      { name: 'آرد', available: false },
      { name: 'زردچوبه', available: true },
    ],
    steps: [
      'سبزی را بشوی و ریز خرد کن.',
      'تخم‌مرغ‌ها را با زردچوبه و آرد هم بزن.',
      'سبزی و پیاز را اضافه کن و مخلوط کن.',
      'در تابهٔ داغ بریز و دو طرفش را طلایی کن.',
    ],
  },
  {
    id: 'r2', name: 'خورش مرغ و لیمو', emoji: '🍲', calories: 480, servings: 4, timeMinutes: 55,
    availabilityPercent: 60, category: 'خورشت', tags: ['الان‌بیز'], usesSoonExpiring: true,
    ingredients: [
      { name: 'مرغ', available: true },
      { name: 'لیمو', available: true },
      { name: 'پیاز', available: true },
      { name: 'رب گوجه', available: false },
      { name: 'برنج', available: true },
    ],
    steps: [
      'پیاز را تفت بده تا طلایی شود.',
      'مرغ را اضافه کن و کمی سرخ کن.',
      'آب و لیمو را بریز و بگذار جا بیفتد.',
      'با برنج سرو کن.',
    ],
  },
  {
    id: 'r3', name: 'عدس‌پلو', emoji: '🍚', calories: 410, servings: 3, timeMinutes: 45,
    availabilityPercent: 50, category: 'پلو', tags: ['کم‌خرج'],
    ingredients: [
      { name: 'برنج', available: true },
      { name: 'عدس', available: false },
      { name: 'پیاز', available: true },
      { name: 'کشمش', available: false },
    ],
    steps: ['عدس را نیم‌پز کن.', 'برنج را آبکش کن.', 'لایه‌ها را بچین و دم کن.', 'با پیاز داغ سرو کن.'],
  },
  {
    id: 'r4', name: 'سالاد شیرازی', emoji: '🥗', calories: 120, servings: 2, timeMinutes: 10,
    availabilityPercent: 75, category: 'سالاد', tags: ['زیر ۳۰ دق', 'الان‌بیز'],
    ingredients: [
      { name: 'گوجه‌فرنگی', available: true },
      { name: 'خیار', available: false },
      { name: 'پیاز', available: true },
      { name: 'لیمو', available: true },
    ],
    steps: ['همه را نگینی خرد کن.', 'آب لیمو و نمک بزن.', 'خنک سرو کن.'],
  },
  {
    id: 'r5', name: 'املت گوجه', emoji: '🍅', calories: 260, servings: 2, timeMinutes: 15,
    availabilityPercent: 75, category: 'سایر', tags: ['زیر ۳۰ دق'], usesSoonExpiring: true,
    ingredients: [
      { name: 'گوجه‌فرنگی', available: true },
      { name: 'تخم‌مرغ', available: true },
      { name: 'زردچوبه', available: true },
      { name: 'کره', available: false },
    ],
    steps: ['گوجه را رنده کن و تفت بده.', 'تخم‌مرغ‌ها را بشکن.', 'هم بزن تا ببندد.'],
  },
];

const shopping = [
  { id: 's1', name: 'عدس', amount: '۵۰۰', unit: 'گرم', emoji: '🥫', purchased: false },
  { id: 's2', name: 'خیار', amount: '۱', unit: 'کیلوگرم', emoji: '🥒', purchased: false },
  { id: 's3', name: 'کشمش', amount: '۲۵۰', unit: 'گرم', emoji: '🍇', purchased: false },
  { id: 's4', name: 'رب گوجه', amount: '۱', unit: 'قوطی', emoji: '🥫', purchased: false },
  { id: 's5', name: 'کره', amount: '۱', unit: 'بسته', emoji: '🧈', purchased: true },
];

const reminders = [
  { id: 'rm1', text: 'سبزی‌ها را فردا مصرف کن', day: 'شنبه', time: '۱۹:۰۰', type: 'بررسی', completed: false, urgent: true, dueAt: Date.now() + 36e5 },
  { id: 'rm2', text: 'خرید هفتگی', day: 'پنجشنبه', time: '۱۸:۰۰', type: 'خرید', completed: false, dueAt: Date.now() + 864e5 },
  { id: 'rm3', text: 'پخت خورش برای مهمانی', day: 'جمعه', time: '۱۲:۰۰', type: 'پخت', completed: true, dueAt: Date.now() + 2 * 864e5 },
];

export function buildSeed(theme = 'light') {
  return {
    state: {
      pantryItems: pantry,
      recipes,
      reminders,
      shoppingItems: shopping,
      userName: 'سارا',
      userInitials: 'س',
      isPremium: true,
      theme,
      dietaryModes: ['حلال'],
      allergies: [],
      notifyExpiry: true,
      notifyWeeklySuggestions: true,
      notifyShopping: true,
      calorieGoal: 2100,
      servingCount: 2,
      anthropicApiKey: '',
      geminiApiKey: '',
      openrouterApiKey: '',
      ollamaApiKey: '',
      ollamaModel: 'gpt-oss:20b-cloud',
      ollamaProxyUrl: '',
      aiProvider: 'gemini',
      backend: 'relay',
      householdSecret: '',
      householdRelayUrl: '',
      serverUrl: '',
      authToken: '',
      account: null,
      serverHousehold: null,
      pushEnabled: false,
      syncState: {},
      syncCursor: 0,
    },
    version: 3,
  };
}
