یک دامنه که رکورد A آن به IP سرور اشاره کند، و پورت‌های ۸۰/۴۴۳ باز باشند.

ssh root@SERVER_IP
apt update && apt install -y docker.io docker-compose-plugin git

git clone https://github.com/arahmatiiii/Lamoo_web.git
cd Lamoo_web/server
cp .env.example .env
nano .env


در .env حداقل این را عوض کنید:

text
Copy
DOMAIN=lamoo.example.com
بقیهٔ مقادیر پیش‌فرض درست‌اند (PORT=8787، دیتابیس SQLite در /data/lamoo.db، CORS_ORIGIN=* چون احراز هویت با توکن است نه کوکی).

bash
Copy
docker compose up -d --build
docker compose logs -f api
تست سلامت:

bash
Copy
curl https://lamoo.example.com/api/health
باید ببینید:

json
Copy
{"ok":true,"registration":true}
اگر جواب نداد اول docker compose logs caddy را ببینید؛ تقریباً همیشه یعنی DNS هنوز به IP سرور اشاره نمی‌کند. Caddy خودش گواهی Let's Encrypt را می‌گیرد و تمدید می‌کند.

بعد از اینکه خودتان و دوستانتان ثبت‌نام کردید، در .env مقدار ALLOW_REGISTRATION=0 بگذارید و docker compose up -d بزنید تا ثبت‌نام بسته شود.
