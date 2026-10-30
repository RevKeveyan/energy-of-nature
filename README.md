# Сухофрукты — Telegram Mini App

Магазин сухофруктов на React + Vite с API на Express. Заказы приходят вам в Telegram.

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Создайте файл `.env` из примера:

```bash
copy .env.example .env
```

3. Заполните `.env`:

- `BOT_TOKEN` — токен от @BotFather
- `ADMIN_CHAT_ID` — id группы для заказов (получите через `/id` в группе)
- `ADMIN_USER_IDS` — Telegram id админов цен через запятую (видно в ответе на `/id` в личке с ботом)
- `ALLOWED_USER_IDS` — белый список id через запятую (бот и заказы только для них)
- `PORT` — порт API (по умолчанию `3001`)

4. Запустите фронт и API вместе:

```bash
npm run dev
```

5. Узнайте `ADMIN_CHAT_ID` (личный чат или **группа**):

- Добавьте бота в группу (для заказов в группу)
- В группе напишите `/id` или `/start`
- Бот ответит `Chat id: ...` (у группы обычно отрицательное число, например `-100123...`)
- Впишите это число в `.env` как `ADMIN_CHAT_ID=...` и перезапустите `npm run dev`

- Магазин: http://localhost:5173  
- API: http://localhost:3001  

В браузере можно оформить тестовый заказ (без Telegram). В Telegram заказ с проверкой `initData`.

## Telegram (открыть магазин внутри Telegram)

Нужен публичный **HTTPS** URL (локальный `localhost` Telegram не откроет).

### Быстрый тест через туннель

1. В одном терминале: `npm run dev`
2. В другом: `cloudflared tunnel --url http://localhost:5173`
3. Скопируйте URL вида `https://....trycloudflare.com`
4. В @BotFather → ваш бот → Bot Settings → Menu Button → Configure menu button → URL магазина  
   Или Configure Mini App → Enable Mini App с тем же URL.
5. Откройте бота в Telegram → кнопка **Магазин** / **Open App**.

Пока ПК выключен или туннель остановлен — магазин в Telegram не откроется.

### Продакшен (Beget VPS, РФ)

Полная инструкция на день: [DEPLOY-BEGET.md](DEPLOY-BEGET.md)  
Шаблоны: `deploy/nginx.conf`, `deploy/tg-shop.service`.

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm run dev` | Vite + Express |
| `npm run build` | Сборка фронта в `dist` |
| `npm start` | Production-сервер (API + статика) |

## Товары и цены

Каталог: `data/products.json`. Mini App читает `GET /api/products`.

Смена цен **в личке с ботом** (нужен id в `ADMIN_USER_IDS`):

```text
/prices
/setprice kuraga 1100
/setprice Курага 1100
```

## Товары

Курага, персики, хурма, арахис, миндаль, грецкий орех, кешью, фундук.
