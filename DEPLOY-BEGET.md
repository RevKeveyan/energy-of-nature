# Деплой на Beget (инструкция на день)

Стек: Beget VPS (Ubuntu) + Node 22 + Nginx + Let's Encrypt + systemd.

Итоговый URL Mini App: `https://energyofnature.ru`

---

## 1. Купить VPS и домен (15–30 мин)

1. Зарегистрируйтесь на [beget.com](https://beget.com).
2. Создайте **VPS/VDS**:
   - OS: **Ubuntu 24.04**
   - **1 vCPU / 2 ГБ RAM / 20+ ГБ** NVMe
   - Регион: **Россия** (Москва или СПб)
3. Купите домен в кабинете Beget (или используйте уже свой).
4. В карточке VPS сохраните:
   - **IP-адрес**
   - логин `root`
   - пароль или SSH-ключ
5. DNS домена (панель Beget → DNS):
   - A-запись `shop` → IP VPS  
   - либо A для `@` и `www`, если магазин на корне домена
6. Подождите 5–30 минут, пока DNS обновится.

Проверка с вашего ПК:

```bash
nslookup shop.ВАШ_ДОМЕН.ru
```

Должен вернуться IP VPS.

---

## 2. Подготовка сервера (40–60 мин)

### 2.1. SSH

```bash
ssh root@ВАШ_IP
```

### 2.2. Пакеты

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx git certbot python3-certbot-nginx
node -v
```

Ожидается Node **v22.x**.

### 2.3. Код приложения

С ПК (PowerShell), из папки проекта — загрузка без git:

```powershell
scp -r "c:\Users\galax\TG app\*" root@ВАШ_IP:/var/www/tg-shop-tmp/
```

На сервере:

```bash
mkdir -p /var/www/tg-shop
rsync -a --exclude node_modules --exclude dist --exclude .git /var/www/tg-shop-tmp/ /var/www/tg-shop/
rm -rf /var/www/tg-shop-tmp
cd /var/www/tg-shop
npm ci
npm run build
```

Если есть приватный git-репозиторий:

```bash
mkdir -p /var/www/tg-shop && cd /var/www/tg-shop
git clone URL_РЕПОЗИТОРИЯ .
npm ci
npm run build
```

### 2.4. Файл `.env` на сервере

```bash
nano /var/www/tg-shop/.env
```

Содержимое (подставьте свои значения из локального `.env`):

```env
BOT_TOKEN=ВАШ_ТОКЕН
ADMIN_CHAT_ID=-5027770014
ADMIN_USER_IDS=834928357,1440226341
ALLOWED_USER_IDS=834928357,1440226341
PORT=3001
NODE_ENV=production
```

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`.

Файл `.env` **не** коммитить в git (уже в `.gitignore`).

### 2.5. systemd

```bash
cp /var/www/tg-shop/deploy/tg-shop.service /etc/systemd/system/tg-shop.service
systemctl daemon-reload
systemctl enable --now tg-shop
systemctl status tg-shop
```

Должно быть `active (running)`. Логи:

```bash
journalctl -u tg-shop -f
```

### 2.6. Проверка Telegram Bot API (критично)

```bash
curl -4 -sS -m 15 -o /dev/null -w "%{http_code}\n" https://api.telegram.org
```

Ожидается `302` или `200`.  
Если таймаут — заказы и `/setprice` не будут работать; напишите в поддержку Beget или смените локацию VPS.

Локальная проверка приложения:

```bash
curl -sS -m 5 http://127.0.0.1:3001/api/products | head -c 200
```

---

## 3. Nginx + HTTPS (20 мин)

### 3.1. Конфиг

```bash
cp /var/www/tg-shop/deploy/nginx.conf /etc/nginx/sites-available/tg-shop
nano /etc/nginx/sites-available/tg-shop
```

Замените `shop.EXAMPLE.ru` на ваш домен, например `shop.energiya-prirody.ru`.

```bash
ln -sf /etc/nginx/sites-available/tg-shop /etc/nginx/sites-enabled/tg-shop
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 3.2. SSL

```bash
certbot --nginx -d shop.ВАШ_ДОМЕН.ru
```

Укажите email, согласитесь с условиями. Certbot сам допишет HTTPS в nginx.

Проверка в браузере: `https://shop.ВАШ_ДОМЕН.ru` — каталог открывается.

---

## 4. BotFather (10 мин)

1. Откройте [@BotFather](https://t.me/BotFather).
2. `/mybots` → `@energy_of_naturebot`.
3. **Bot Settings → Menu Button → Configure menu button**  
   URL: `https://shop.ВАШ_ДОМЕН.ru`
4. **Configure Mini App → Edit Mini App URL** (или Enable)  
   Тот же URL: `https://shop.ВАШ_ДОМЕН.ru`
5. Откройте бота в Telegram → кнопка **Магазин** слева от скрепки.  
   Из группы: `https://t.me/energy_of_naturebot?startapp`

Проверки:

- Магазин открывается **внутри Telegram**, не в браузере
- Товары загружаются
- Тестовый заказ приходит в группу
- В личке бота: `/prices`, `/setprice`

---

## 5. Обновление кода после правок

На сервере:

```bash
cd /var/www/tg-shop
# залить новые файлы (scp/git pull)
npm ci
npm run build
systemctl restart tg-shop
```

---

## Чеклист конца дня

- [ ] VPS Ubuntu 2 ГБ и домен куплены
- [ ] DNS A `shop` → IP VPS
- [ ] `systemctl status tg-shop` — active
- [ ] `https://shop.ВАШ_ДОМЕН.ru` открывается без предупреждения SSL
- [ ] `api.telegram.org` с VPS отвечает
- [ ] BotFather Menu Button + Mini App = ваш HTTPS URL
- [ ] Тестовый заказ пришёл в группу

---

## Файлы в репозитории

| Файл | Назначение |
|------|------------|
| [deploy/nginx.conf](deploy/nginx.conf) | Шаблон Nginx (замените `server_name`) |
| [deploy/tg-shop.service](deploy/tg-shop.service) | systemd unit |
| [DEPLOY-BEGET.md](DEPLOY-BEGET.md) | Эта инструкция |
