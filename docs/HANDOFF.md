# بردن کار روی سرور خودت

## اول: چرا این سشن اونجا دیده نمی‌شه

سشن‌های Claude Code بین دستگاه‌ها منتقل نمی‌شن. اکانت مشترک فقط لاگین و
اشتراک رو مشترک می‌کنه، نه تاریخچهٔ گفت‌وگو رو.

- این سشن داخل یک کانتینر ابری روی زیرساخت claude.ai اجرا می‌شه.
- Claude Code روی سرور تو یک نصب محلی و جداست. تاریخچه‌اش در
  `~/.claude/projects/<اسم-مسیر-پروژه>/<uuid>.jsonl` روی **همون ماشین** ذخیره می‌شه.
- هیچ‌کدام تاریخچهٔ اون یکی رو نمی‌بینه.

**چیزی که کار رو منتقل می‌کنه، مخزن گیت است.** همهٔ کدها روی `master` مرج شده‌اند؛
روی سرور فقط باید clone کنی و از همون نقطه ادامه بدی.

## مرحله به مرحله روی سرور

```bash
# ۱. پیش‌نیازها (اوبونتو/دبیان) — Node 22 یا بالاتر لازم است
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # باید v22.x یا بالاتر باشد

# ۲. گرفتن پروژه
git clone https://github.com/arahmatiiii/Lamoo_web.git
cd Lamoo_web

# ۳. نصب و تست — اگر این سه تا سبز بودند، انتقال کامل است
npm ci
npm test
npm run typecheck
npm run build

# ۴. اجرای Claude Code داخل همین پوشه
claude
```

پیام اولت به Claude Code روی سرور را این‌طور بده تا بدون معطلی وارد کار بشه:

> کل `docs/HANDOFF.md` و `docs/SERVER.md` را بخوان. کار قبلی روی یک ماشین دیگر
> انجام شده و همه‌چیز روی `master` مرج شده. می‌خواهم فاز سرور را از
> `docs/SERVER.md` ادامه بدهی. روی برنچ `claude/awp-android-overlap-bug-q0bmam`
> کار کن.

## دیدن سشن‌های سرور داخل اپ Claude

اگر می‌خواهی سشن‌هایی که روی سرور اجرا می‌شن را از اپ موبایل/دسکتاپ Claude هم
ببینی و ادامه بدی، روی سرور داخل پوشهٔ پروژه این را اجرا کن:

```bash
claude remote-control
```

تا وقتی این دستور در حال اجراست، اون سشن در اپ Claude Code ظاهر می‌شه و می‌تونی
از گوشی بهش پیام بدی. با `tmux` یا `screen` اجراش کن تا با قطع شدن SSH نمیره:

```bash
sudo apt install -y tmux
tmux new -s lamoo
cd ~/Lamoo_web && claude remote-control
# جدا شدن بدون بستن: Ctrl+b بعد d
# برگشتن: tmux attach -t lamoo
```

این کار **این** سشن را منتقل نمی‌کنه — یک سشن جدید روی سرور می‌سازه که از اپ هم
قابل دیدنه. تاریخچهٔ این گفت‌وگو همون‌جا که هست می‌مونه.

## (اختیاری) بردن تاریخچهٔ گفت‌وگو

اگر خودِ متن این گفت‌وگو را هم اونجا خواستی، فایل transcript را دستی کپی کن.
مسیرش از روی مسیر پوشهٔ کاری ساخته می‌شه: هر کاراکتر غیرحرف/رقم تبدیل به `-`
می‌شه. یعنی `/home/user/Lamoo_web` می‌شه `-home-user-Lamoo-web`.

```bash
# روی سرور، اگر پروژه در /root/Lamoo_web است:
mkdir -p ~/.claude/projects/-root-Lamoo-web
# فایل .jsonl را داخل همین پوشه بگذار، بعد:
claude --resume
```

لازم نیست. خوندن همین دو تا داکیومنت برای ادامهٔ کار کافیه و مطمئن‌تره.

## وضعیت فعلی پروژه (تا این نقطه)

اپ یک PWA فارسی/راست‌به‌چپ برای مدیریت انبار آشپزخانه است: React 19 + TypeScript
+ Vite 7 (بیلد تک‌فایل) + Tailwind 4 + Zustand 5 با `persist`.

**چیزهایی که کار می‌کنند:**

| بخش | فایل‌های اصلی |
| --- | --- |
| خانه به‌عنوان تصمیم‌یار («امشب چی می‌چسبه؟»، چیپ‌های حالت، یک پیشنهاد + دلیلش) | `src/components/HomePage.tsx`, `src/utils/suggest.ts` |
| انبار با تاریخ انقضای مطلق (نه روزشمار) + مصرف با امکان undo | `src/components/PantryPage.tsx`, `src/store/useStore.ts` |
| آشپزی قدم‌به‌قدم با Wake Lock، تایمر هر مرحله، و زمان سپری‌شده | `src/components/CookMode.tsx`, `src/utils/cook.ts` |
| موجودی مواد دستور پخت — مشتق‌شده از انبار، نه ذخیره‌شده | `src/utils/recipes.ts` |
| لیست خرید؛ تیک خوردن یک قلم = رفتنش به انبار | `src/components/ShoppingPage.tsx`, `useStore.purchaseShoppingItem` |
| هوش مصنوعی: Gemini / OpenRouter / Anthropic / Ollama Cloud با اعتبارسنجی خروجی | `src/utils/ai.ts` |
| کارت اشتراک‌گذاری (رندر Canvas + Web Share) | `src/components/ShareCard.tsx` |
| آشپزخانهٔ مشترک — رمزنگاری سرتاسری روی رلهٔ Cloudflare | `src/utils/household.ts`, `sync.ts`, `syncEngine.ts`, `cloudflare-worker/relay/` |
| تم روشن/تاریک | `src/index.css`, `useStore.theme` |

**تست:** ۱۸۴ تست برای اپ (`npm test`) و ۹۴ تست برای سرور (`npm run test:server`)؛
`npm run test:all` هر دو را می‌زند و باید کاملاً سبز باشه. هر تغییری روی منطق
sync یا انقضا بدون تست نرو جلو — همهٔ باگ‌های جدی این پروژه از «state
مشتق‌شده که ذخیره شده بود» آمدند.

یکی از این تست‌ها مهم‌تر از بقیه است: `src/utils/sync.parity.test.ts` مطمئن
می‌شود قاعدهٔ merge کلاینت و سرور مو‌به‌مو یکی است. اگر یکی را دست بزنی و
دیگری را نه، این تست می‌افتد — و اگر نمی‌افتاد، دو گوشی برای همیشه دو جواب
مختلف نگه می‌داشتند.

**CI:** `.github/workflows/test.yml` هر دو سوئیت تست را روی هر push و PR می‌زنه؛
`apk.yml` با Capacitor فایل APK می‌سازه و روی تگ ثابت `apk` منتشرش می‌کنه؛
`deploy.yml` نسخهٔ وب را روی GitHub Pages می‌بره.

**برنچ کاری:** `claude/awp-android-overlap-bug-q0bmam` → PR به `master`.

## چیزی که هنوز ساخته نشده

فاز ۱ سرور ساخته شده و تست دارد (`server/` — اکانت، آشپزخانهٔ مشترک سرورساید،
دوستان، فید کارت‌ها، WebSocket زنده). چیزی که مانده:

۱. **وصل کردن کلاینت به سرور** — فاز ۲ در `docs/SERVER.md`. تنظیمات باید دو
   حالت داشته باشد: «سرور خودم» و «رلهٔ رمزشده». موتور merge دست‌نخورده می‌ماند و
   فقط ترنسپورت عوض می‌شود.
۲. **رابط کاربری دوستان و استوری** — فاز ۳. API‌اش آماده و تست‌شده است؛ صفحه‌اش
   ساخته نشده.
۳. **نوتیفیکیشن ریمایندر با Web Push** — فاز ۴. جدولش (`push_subs`) ساخته شده،
   هنوز چیزی ازش نمی‌خواند.
