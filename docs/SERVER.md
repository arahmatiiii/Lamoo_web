# فاز سرور: آشپزخانهٔ مشترک و دوستان

## تصمیم و هزینه‌اش

تا اینجا آشپزخانهٔ مشترک **رمزنگاری سرتاسری** بود: رلهٔ Cloudflare فقط بستهٔ
رمزشده را جابه‌جا می‌کرد و حتی خودِ رله هم نمی‌توانست بفهمد داخل یخچال تو چیست.

خواستهٔ تو این است که هر دو بخش کامل سرورساید بشوند. این کار یک چیز را از دست
می‌دهد که باید آگاهانه از دستش بدهیم: **سرور محتوای انبار، دستورها و لیست خرید را
به‌صورت خوانا نگه می‌دارد.** در عوض چهار چیز به دست می‌آید که با معماری رمزشده
ممکن نبود:

1. **دوستان و استوری** اصلاً بدون سرور خوانا شدنی نیست — سرور باید بداند کارت
   اشتراکی کدام کاربر را به کدام دوست نشان بدهد.
2. **نوتیفیکیشن واقعی** برای ریمایندرها، حتی وقتی اپ بسته است (Web Push).
3. **اکانت واقعی**: اگر گوشی‌ات گم شد، با رمز خودت برمی‌گردی. در مدل قبلی گم شدن
   کد دعوت یعنی گم شدن خانه.
4. **هر تعداد عضو** و تاریخچه، نه فقط دو گوشی که هم‌زمان آنلاین‌اند.

سرور مال خودت است، نه یک سرویس ابری شخص ثالث — بنابراین «سرور می‌تواند بخواند»
یعنی «تو می‌توانی بخوانی». همین است که این معاوضه را قابل قبول می‌کند.

**رلهٔ رمزشدهٔ Cloudflare پاک نمی‌شود.** در تنظیمات دو حالت می‌ماند و کاربر
انتخاب می‌کند: «سرور خودم» (پیش‌فرض، با اکانت و دوستان) یا «رلهٔ رمزشده» (بدون
اکانت، بدون دوستان، هیچ‌کس نمی‌تواند بخواند). کد هر دو در مخزن است.

## فرضی که گرفته‌ام

معماری زیر برای **مقیاس کوچک** نوشته شده: خودت، خانواده، و دوستان — تا حدود چند
هزار کاربر روی یک VPS. SQLite کافی است و نیازی به Postgres نیست. اگر بعداً
خواستی عمومی منتشرش کنی، این چیزها لازم می‌شود و الان نیست: تأیید شمارهٔ موبایل،
محدودیت نرخ per-IP جدی‌تر، مدیریت محتوا و گزارش تخلف برای کارت‌ها، و پشتیبان‌گیری
خارج از سرور. جای هرکدام در کد علامت‌گذاری شده.

## پشته

| لایه | انتخاب | چرا |
| --- | --- | --- |
| اجرا | Node 22 + TypeScript | همان زبان کلاینت، منطق merge مشترک |
| وب‌سرور | Fastify 5 + `@fastify/websocket` | سبک، WebSocket درجا |
| دیتابیس | `node:sqlite` (داخل خود Node) | صفر وابستگی نیتیو، یک فایل، بکاپ = `cp` |
| TLS و دامنه | Caddy | گواهی Let's Encrypt خودکار، کانفیگ سه خطی |
| بسته‌بندی | Docker Compose | `docker compose up -d` و تمام |
| احراز هویت | توکن opaque تصادفی، هش‌شده در DB | قابل ابطال، بدون پیچیدگی JWT |
| رمز عبور | `scrypt` از `node:crypto` | بدون وابستگی نیتیو مثل argon2 |

## مدل داده

```
users(id, handle, password_hash, display_name, friend_code, household_id, created_at)
tokens(token_hash, user_id, created_at, last_seen_at)
households(id, name, invite_code, created_at)
records(household_id, kind, record_id, updated_at, deleted, value_json, seq)
   -- kind ∈ pantry | recipe | shopping | reminder
   -- کلید یکتا: (household_id, kind, record_id)
   -- seq یک شمارندهٔ صعودی سرور است؛ کلاینت با ?since=seq دلتا می‌گیرد
friendships(id, requester_id, addressee_id, status, created_at)
   -- status ∈ pending | accepted
cards(id, author_id, title, note, recipe_json, image_id, created_at, expires_at)
card_views(card_id, user_id, seen_at)
card_saves(card_id, user_id, saved_at)
media(id, owner_id, mime, bytes, created_at)
push_subs(id, user_id, endpoint, p256dh, auth, created_at)
```

نکتهٔ کلیدی: `records` **همان مدل LWW کلاینت** است، فقط خوانا.
`SyncRecord {kind, id, updatedAt, deleted?, value?}` بدون تغییر می‌ماند و قاعدهٔ
merge سرور بیت‌به‌بیت همان `mergeRecord` در `src/utils/sync.ts` است — از جمله
tiebreak روی سریال‌سازی canonical وقتی `updatedAt` مساوی است. اگر این دو از هم
واگرا بشوند، دو گوشی برای همیشه دو جواب مختلف نگه می‌دارند؛ این دقیقاً باگی بود
که یک‌بار تست‌ها گرفتند.

## API

```
POST   /api/auth/register   {handle, password, displayName}  → {token, user}
POST   /api/auth/login      {handle, password}               → {token, user}
POST   /api/auth/logout                                      → {}
GET    /api/me                                               → {user, household, friendCode}

POST   /api/household                {name}                  → {household}   ساخت
POST   /api/household/join           {code}                  → {household}
POST   /api/household/leave                                  → {}
GET    /api/household/members                                → {members}
GET    /api/household/records?since=N                        → {records, cursor}
POST   /api/household/records        {records:[SyncRecord]}   → {records, cursor}
WS     /api/household/socket?token=…  pull/push ↔ records

GET    /api/friends                                          → {friends, incoming, outgoing}
POST   /api/friends/request          {code}                  → {friendship}
POST   /api/friends/:id/accept                               → {friendship}
DELETE /api/friends/:id                                      → {}

POST   /api/cards                    {title,note,recipe,image?} → {card}
GET    /api/feed                                             → {cards}   کارت‌های دوستان
GET    /api/cards/:id                                        → {card}    با جزئیات کامل دستور
POST   /api/cards/:id/seen                                   → {}
POST   /api/cards/:id/save                                   → {}
GET    /media/:id                                            → بایت تصویر
```

قرارداد WebSocket عیناً همان چیزی است که `src/utils/syncEngine.ts` امروز با رلهٔ
Cloudflare حرف می‌زند (`{type:'pull',since}` / `{type:'push',records}` /
`{type:'records',records}`) با دو تفاوت: توکن در query string می‌آید، و
`payload` رمزنشده است. یعنی موتور sync کلاینت با کمترین تغییر به هر دو وصل می‌شود.

## فازها

### فاز ۱ — پایه و آشپزخانهٔ مشترک سرورساید ✅ (کدش در `server/` هست)

اکانت، توکن، خانوار، merge سرورساید، دلتا با `since`، WebSocket زنده، تست.

### فاز ۲ — وصل کردن کلاینت

- در `useStore`: فیلد `backend: 'relay' | 'server'` + `serverUrl` + `authToken`.
- `syncEngine.ts` به دو ترنسپورت تقسیم شود: `relayTransport` (رمزشده، امروز) و
  `serverTransport` (توکن‌دار، خوانا). موتور merge دست‌نخورده می‌ماند.
- `HouseholdSection.tsx` بشود دو تب: «سرور خودم» و «رلهٔ رمزشده».
- ورود/ثبت‌نام: یک شیت ساده با handle و رمز.
- مسیر مهاجرت: کاربری که روی رله بود، با اولین اتصال به سرور کل `syncState`
  خودش را push می‌کند؛ چون LWW است، چیزی گم نمی‌شود.

### فاز ۳ — دوستان و استوری

- کد دوستی کوتاه (۸ کاراکتر) برای هر کاربر. برخلاف کد دعوت خانوار، این کد
  **دسترسی نمی‌دهد** — فقط درخواست می‌سازد و طرف باید قبول کند.
- `ShareCard.tsx` علاوه بر Web Share، دکمهٔ «برای دوستام بگذار» بگیرد که کارت را
  با اسنپ‌شات کامل دستور پخت روی سرور می‌گذارد (پیش‌فرض ۲۴ ساعت).
- صفحهٔ جدید «دوستان»: نوار دایره‌ای استوری بالای فید + خواندن کارت تمام‌صفحه.
- «به دفتر خودم اضافه کن» → دستور کامل با مواد و مراحل در `recipes` خودت ذخیره
  می‌شود، و چون availability مشتق‌شده است، کمبودها همان لحظه درست درمی‌آیند.

### فاز ۴ — نوتیفیکیشن ریمایندر

Web Push با VAPID. سرور یک cron دقیقه‌ای دارد که ریمایندرهای سررسیده و مواد
نزدیک انقضا را پیدا و push می‌کند. این تنها کاری است که کلاینت به‌تنهایی هرگز
نمی‌تواند انجام دهد، و دلیل اصلی ارزش داشتن سرور است.

## استقرار روی سرور

```bash
cd ~/Lamoo_web/server
cp .env.example .env
# یک SECRET تصادفی بگذار:  openssl rand -hex 32
nano .env
docker compose up -d --build
docker compose logs -f api
```

بکاپ کل دیتا:

```bash
docker compose exec api node -e "require('node:fs').copyFileSync('/data/lamoo.db','/data/backup.db')"
cp ./data/backup.db ~/lamoo-$(date +%F).db
```

برای اجرای بدون داکر (توسعه):

```bash
cd server && npm install && npm test && npm run dev
```
