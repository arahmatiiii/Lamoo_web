# راه‌اندازی دستی روی سرور

همه‌چیز ساخته شده. این فایل فقط کارهایی است که خودت باید یک‌بار انجام بدهی.
از اول تا آخرش حدود ۱۵ دقیقه است.

سروری که می‌خری فقط برای **ران کردن** است؛ نیازی به Claude Code یا هیچ ابزار
دیگری روی آن نیست.

---

## پیش‌نیاز: یک دامنه که به سرورت اشاره کند

Web Push و Service Worker فقط روی HTTPS کار می‌کنند، و برای HTTPS به یک دامنه
نیاز است. یک رکورد `A` بساز که به IP سرورت اشاره کند، مثلاً:

```
lamoo.example.com   A   203.0.113.10
```

بعد مطمئن شو پورت‌های ۸۰ و ۴۴۳ روی سرور باز هستند. Caddy خودش گواهی
Let's Encrypt را می‌گیرد و تمدید می‌کند؛ کار دیگری لازم نیست.

## ۱. نصب داکر

```bash
ssh root@<IP-سرورت>
apt update && apt install -y docker.io docker-compose-plugin git
docker --version
```

## ۲. گرفتن پروژه

```bash
cd ~
git clone https://github.com/arahmatiiii/Lamoo_web.git
cd Lamoo_web/server
```

## ۳. تنظیمات

```bash
cp .env.example .env
nano .env
```

حداقل این یکی را عوض کن:

```
DOMAIN=lamoo.example.com
```

## ۴. ساخت کلید نوتیفیکیشن (VAPID)

بدون این هم همه‌چیز کار می‌کند، فقط نوتیفیکیشن نه. برای روشن کردنش:

```bash
docker compose run --rm api node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

خروجی دو کلید است. همان‌ها را در `.env` بگذار:

```
VAPID_PUBLIC_KEY=B....
VAPID_PRIVATE_KEY=....
VAPID_SUBJECT=mailto:اایمیل-خودت@example.com
```

## ۵. بالا آوردن

```bash
docker compose up -d --build
docker compose logs -f api      # با Ctrl+C از لاگ بیرون بیا
```

تست کن:

```bash
curl https://lamoo.example.com/api/health
```

باید این را ببینی:

```json
{"ok":true,"registration":true,"push":true}
```

اگر `push` برابر `false` بود یعنی کلید VAPID را نگذاشته‌ای.
اگر اصلاً جواب نداد، اول `docker compose logs caddy` را ببین — تقریباً همیشه
یعنی دامنه هنوز به IP سرور اشاره نمی‌کند.

## ۶. وصل کردن اپ

اپ همان چیزی است که همیشه بوده (GitHub Pages یا فایل APK). سروری که ساختی را
یک‌بار در خود اپ معرفی می‌کنی:

۱. اپ را باز کن → روی آواتار بالای صفحه بزن (تنظیمات).
۲. بخش «آشپزخانهٔ مشترک» → حالت **«سرور خودم»** را انتخاب کن.
۳. آدرس سرورت را وارد کن: `https://lamoo.example.com`
۴. «ورود یا ساخت اکانت» → «اکانت ندارم، بسازم» → نام کاربری و رمز.
۵. «ساخت آشپزخانهٔ مشترک» را بزن. یک کد ۱۲ رقمی می‌گیری.
۶. روی گوشی همسرت همین مراحل را برو، ولی به‌جای ساختن، کد را در کادر
   «کد دعوت» بچسبان و «وصل شو» را بزن.

از این لحظه انبار، لیست خرید، دستورها و یادآورها روی هر دو گوشی یکی هستند.

**نوتیفیکیشن:** در همان صفحه «نوتیفیکیشن یادآورها» را روشن کن و اجازه را بده.
روی اندروید و دسکتاپ کار می‌کند؛ روی iOS فقط وقتی اپ را از سافاری به
هوم‌اسکرین اضافه کرده باشی.

**دوستان:** تب «دوستان» در نوار پایین. کد دوستی‌ات را به دوستت بده و کد او را
وارد کن. بعد از قبول کردن، هر کارتی که از یک دستور بسازید در فید آن یکی
می‌آید و با یک دکمه با تمام مواد و مراحل به دفتر خودش اضافه می‌شود.

## ۷. بستن ثبت‌نام

وقتی همه ثبت‌نام کردند، در `.env` بگذار `ALLOW_REGISTRATION=0` و بعد:

```bash
docker compose up -d
```

از این به بعد کسی نمی‌تواند روی سرورت اکانت بسازد. خودت هر وقت خواستی
دوباره `1` کن.

## بکاپ

همه‌چیز — کاربرها، انبار، دستورها، کارت‌ها و عکس‌ها — در یک فایل است:

```bash
cd ~/Lamoo_web/server
docker compose exec api node -e "\
const {DatabaseSync}=require('node:sqlite');\
new DatabaseSync('/data/lamoo.db').exec(\"VACUUM INTO '/data/backup.db'\")"
cp ./data/backup.db ~/lamoo-$(date +%F).db
```

برای بکاپ خودکار، این را در `crontab -e` بگذار (هر شب ساعت ۳):

```
0 3 * * * cd /root/Lamoo_web/server && docker compose exec -T api node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/lamoo.db').exec(\"VACUUM INTO '/data/backup.db'\")" && cp ./data/backup.db /root/backups/lamoo-$(date +\%F).db
```

(اول `mkdir -p /root/backups`.)

## به‌روزرسانی بعد از تغییر کد

```bash
cd ~/Lamoo_web
git pull
cd server
docker compose up -d --build
```

دیتابیس روی volume است و با build دوباره از بین نمی‌رود.

## اگر چیزی کار نکرد

| نشانه | معمولاً یعنی |
| --- | --- |
| `curl` به دامنه جواب نمی‌دهد | رکورد DNS هنوز پخش نشده، یا پورت ۸۰/۴۴۳ بسته است |
| خطای گواهی در مرورگر | Caddy هنوز گواهی نگرفته — `docker compose logs caddy` |
| اپ می‌گوید «به سرور وصل نشد» | آدرس در تنظیمات اشتباه است یا `https://` ندارد |
| `push` در health برابر `false` | کلید VAPID در `.env` نیست |
| نوتیفیکیشن روی iOS نمی‌آید | اپ باید از سافاری به هوم‌اسکرین اضافه شده باشد |
| «این نام کاربری گرفته شده» | همان است — نام دیگری بگذار |
| ثبت‌نام ۴۰۳ می‌دهد | `ALLOW_REGISTRATION=0` است |

لاگ‌ها:

```bash
docker compose logs -f api
docker compose logs -f caddy
```
