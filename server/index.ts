import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import {
  addProduct,
  formatPricesList,
  readProducts,
  removeProduct,
  setProductPrice,
  type Product,
  type ProductCategory,
} from './productsStore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(rootDir, '.env') })

const PORT = Number(process.env.PORT) || 3001
const BOT_TOKEN = (process.env.BOT_TOKEN ?? '').trim()
const ADMIN_CHAT_ID = (process.env.ADMIN_CHAT_ID ?? '').trim()
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS ?? process.env.ADMIN_USER_ID ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const ALLOWED_USER_IDS = (process.env.ALLOWED_USER_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isDev = NODE_ENV !== 'production'
const BOT_USERNAME = (process.env.BOT_USERNAME ?? 'energy_of_naturebot').trim().replace(/^@/, '')
const MINI_APP_LINK = `https://t.me/${BOT_USERNAME}?startapp`

const BTN_HELP = 'Помощь'
const BTN_PRICES = 'Цены'
const BTN_ADD = 'Добавить товар'
const BTN_DELETE = 'Удалить товар'
const BTN_ID = 'Мой id'
const BTN_CANCEL = 'Отмена'

type AddWizardState = {
  step: 'category' | 'name' | 'price' | 'photo'
  category?: ProductCategory
  name?: string
  pricePerKg?: number
}

type DeleteWizardState = {
  step: 'query' | 'confirm'
  product?: Product
}

const addWizards = new Map<number, AddWizardState>()
const deleteWizards = new Map<number, DeleteWizardState>()

function isAllowedUser(userId?: number): boolean {
  if (userId == null) return false
  if (ALLOWED_USER_IDS.length === 0) return true
  return ALLOWED_USER_IDS.includes(String(userId))
}

type OrderItem = {
  productId: string
  name: string
  pricePerKg: number
  quantityKg: number
}

type OrderBody = {
  items: OrderItem[]
  name: string
  phone: string
  address: string
  comment?: string
  initData?: string
}

function validateInitData(initData: string, botToken: string): { ok: true; userId?: number } | { ok: false; error: string } {
  if (!initData) {
    return { ok: false, error: 'initData is empty' }
  }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    return { ok: false, error: 'hash missing' }
  }

  const entries: string[] = []
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue
    entries.push(`${key}=${value}`)
  }
  entries.sort()
  const dataCheckString = entries.join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (calculatedHash !== hash) {
    return { ok: false, error: 'invalid hash' }
  }

  const authDate = Number(params.get('auth_date') ?? 0)
  const maxAgeSec = 86400
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    return { ok: false, error: 'initData expired' }
  }

  let userId: number | undefined
  const userRaw = params.get('user')
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw) as { id?: number }
      if (typeof user.id === 'number') userId = user.id
    } catch {
      return { ok: false, error: 'invalid user payload' }
    }
  }

  return { ok: true, userId }
}

function formatOrderMessage(order: OrderBody, telegramUserId?: number): string {
  const lines: string[] = ['🛒 Новый заказ', '']
  for (const item of order.items) {
    const lineTotal = item.pricePerKg * item.quantityKg
    lines.push(`• ${item.name} — ${item.quantityKg} кг × ${item.pricePerKg} ₽ = ${lineTotal} ₽`)
  }
  const total = order.items.reduce((sum, item) => sum + item.pricePerKg * item.quantityKg, 0)
  lines.push('', `Итого: ${total} ₽`, '')
  lines.push(`Имя: ${order.name}`)
  lines.push(`Телефон: ${order.phone}`)
  lines.push(`Адрес: ${order.address}`)
  if (order.comment?.trim()) {
    lines.push(`Комментарий: ${order.comment.trim()}`)
  }
  if (telegramUserId) {
    lines.push(`Telegram ID: ${telegramUserId}`)
  }
  return lines.join('\n')
}

function replyKeyboard(userId?: number) {
  if (isAdminUser(userId)) {
    return {
      keyboard: [
        [{ text: BTN_HELP }, { text: BTN_PRICES }],
        [{ text: BTN_ADD }, { text: BTN_DELETE }],
        [{ text: BTN_ID }, { text: BTN_CANCEL }],
      ],
      resize_keyboard: true,
    }
  }
  return {
    keyboard: [[{ text: BTN_HELP }, { text: BTN_ID }]],
    resize_keyboard: true,
  }
}

function categoryKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Фруктовые', callback_data: 'addcat:fruit' },
        { text: 'Ягоды', callback_data: 'addcat:berries' },
        { text: 'Орехи', callback_data: 'addcat:nuts' },
      ],
      [{ text: BTN_CANCEL, callback_data: 'addcat:cancel' }],
    ],
  }
}

function shopKeyboard() {
  return {
    inline_keyboard: [[{ text: 'Открыть магазин', url: MINI_APP_LINK }]],
  }
}

async function sendShopMessage(chatId: string | number): Promise<void> {
  await sendTelegramMessageTo(
    chatId,
    'Магазин «Энергия природы»\nНажмите кнопку, чтобы открыть каталог.',
    { reply_markup: shopKeyboard() },
  )
}

function helpText(userId?: number): string {
  if (isAdminUser(userId)) {
    return [
      'Команды администратора:',
      '',
      '/help — эта справка',
      '/start или /id — ваш chat id и user id',
      '/prices — список товаров и цен',
      '/setprice <id|название> <цена>',
      '  Пример: /setprice kuraga 1100',
      '  Пример: /setprice Курага 1100',
      '/add — добавить товар (категория → название → цена → фото)',
      '/delete — удалить товар (id или название, затем подтверждение)',
      '  Пример: /delete kuraga',
      '  Пример: /delete Курага мелкая',
      '/shop — кнопка открытия магазина (для групп)',
      '/cancel — отменить текущее действие',
      '',
      'Кнопки внизу дублируют частые команды.',
      'Магазин: кнопка «Магазин» слева от скрепки или /shop.',
    ].join('\n')
  }
  return [
    'Доступные команды:',
    '',
    '/help — эта справка',
    '/start или /id — ваш chat id и user id',
    '/shop — открыть магазин',
    '',
    'Магазин: кнопка «Магазин» слева от скрепки или /shop.',
  ].join('\n')
}

async function telegramApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!BOT_TOKEN) {
    throw new Error('BOT_TOKEN is not configured')
  }
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as { ok: boolean; description?: string; result?: unknown }
  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API error: ${method}`)
  }
  return data.result
}

async function sendTelegramMessageTo(
  chatId: string | number,
  text: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    ...extra,
  })
}

async function sendTelegramMessage(text: string): Promise<void> {
  if (!ADMIN_CHAT_ID) {
    throw new Error('ADMIN_CHAT_ID is not configured')
  }
  await sendTelegramMessageTo(ADMIN_CHAT_ID, text)
}

type TelegramChat = {
  id: number
  type: string
  title?: string
}

type TelegramPhotoSize = {
  file_id: string
  width: number
  height: number
  file_size?: number
}

type TelegramMessage = {
  text?: string
  caption?: string
  photo?: TelegramPhotoSize[]
  chat: TelegramChat
  from?: { id: number }
}

type TelegramCallbackQuery = {
  id: string
  from: { id: number }
  data?: string
  message?: {
    chat: TelegramChat
    message_id: number
  }
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
  my_chat_member?: {
    chat: TelegramChat
    new_chat_member?: {
      status: string
    }
  }
}

function commandName(text: string): string {
  const first = text.trim().split(/\s+/)[0] ?? ''
  return first.split('@')[0].toLowerCase()
}

function isAdminUser(userId?: number): boolean {
  if (userId == null || ADMIN_USER_IDS.length === 0) return false
  return ADMIN_USER_IDS.includes(String(userId))
}

function normalizeButtonText(text: string): string {
  return text.trim()
}

function mapButtonToCommand(text: string): string | null {
  const label = normalizeButtonText(text)
  if (label === BTN_HELP) return '/help'
  if (label === BTN_PRICES) return '/prices'
  if (label === BTN_ADD) return '/add'
  if (label === BTN_DELETE) return '/delete'
  if (label === BTN_ID) return '/id'
  if (label === BTN_CANCEL) return '/cancel'
  return null
}

function deleteConfirmKeyboard(productId: string) {
  return {
    inline_keyboard: [
      [
        { text: 'Да, удалить', callback_data: `delok:${productId}` },
        { text: 'Нет', callback_data: 'delok:cancel' },
      ],
    ],
  }
}

async function startAddWizard(chatId: number, userId: number): Promise<void> {
  deleteWizards.delete(userId)
  addWizards.set(userId, { step: 'category' })
  await sendTelegramMessageTo(chatId, 'Добавление товара.\nВыберите категорию:', {
    reply_markup: categoryKeyboard(),
  })
}

async function startDeleteWizard(
  chatId: number,
  userId: number,
  query?: string,
): Promise<void> {
  addWizards.delete(userId)
  if (query?.trim()) {
    await promptDeleteConfirm(chatId, userId, query.trim())
    return
  }
  deleteWizards.set(userId, { step: 'query' })
  await sendTelegramMessageTo(
    chatId,
    'Удаление товара.\nПришлите id или точное название.\nПример: kuraga-small\nили: Курага мелкая\n\nОтмена: /cancel',
  )
}

async function promptDeleteConfirm(
  chatId: number,
  userId: number,
  query: string,
): Promise<void> {
  try {
    const products = readProducts()
    const normalized = query.trim().toLowerCase()
    const product = products.find(
      (item) =>
        item.id.toLowerCase() === normalized ||
        item.name.toLowerCase() === normalized,
    )
    if (!product) {
      deleteWizards.delete(userId)
      await sendTelegramMessageTo(
        chatId,
        'Товар не найден. Смотрите список: /prices',
        { reply_markup: replyKeyboard(userId) },
      )
      return
    }
    deleteWizards.set(userId, { step: 'confirm', product })
    await sendTelegramMessageTo(
      chatId,
      `Удалить товар?\n${product.name} (${product.id}) — ${product.pricePerKg} ₽/кг`,
      { reply_markup: deleteConfirmKeyboard(product.id) },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    console.error('Delete lookup failed:', message)
    deleteWizards.delete(userId)
    await sendTelegramMessageTo(chatId, 'Не удалось найти товар.', {
      reply_markup: replyKeyboard(userId),
    })
  }
}

async function cancelWizards(chatId: number, userId: number): Promise<void> {
  const had = addWizards.has(userId) || deleteWizards.has(userId)
  addWizards.delete(userId)
  deleteWizards.delete(userId)
  await sendTelegramMessageTo(
    chatId,
    had ? 'Действие отменено.' : 'Нечего отменять.',
    { reply_markup: replyKeyboard(userId) },
  )
}

async function handleDeleteWizardText(
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  const state = deleteWizards.get(userId)
  if (!state) return false

  if (commandName(text) === '/cancel' || normalizeButtonText(text) === BTN_CANCEL) {
    await cancelWizards(chatId, userId)
    return true
  }

  if (state.step === 'query') {
    await promptDeleteConfirm(chatId, userId, text)
    return true
  }

  if (state.step === 'confirm') {
    await sendTelegramMessageTo(
      chatId,
      'Подтвердите удаление кнопками под сообщением или /cancel.',
      state.product
        ? { reply_markup: deleteConfirmKeyboard(state.product.id) }
        : undefined,
    )
    return true
  }

  return true
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const file = (await telegramApi('getFile', { file_id: fileId })) as { file_path?: string }
  if (!file.file_path) {
    throw new Error('file_path missing')
  }
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to download file')
  }
  return Buffer.from(await response.arrayBuffer())
}

async function handleAddWizardText(
  chatId: number,
  userId: number,
  text: string,
): Promise<boolean> {
  const state = addWizards.get(userId)
  if (!state) return false

  if (commandName(text) === '/cancel' || normalizeButtonText(text) === BTN_CANCEL) {
    await cancelWizards(chatId, userId)
    return true
  }

  if (state.step === 'name') {
    const name = text.trim()
    if (!name || name.startsWith('/')) {
      await sendTelegramMessageTo(chatId, 'Пришлите название товара текстом.')
      return true
    }
    state.name = name
    state.step = 'price'
    addWizards.set(userId, state)
    await sendTelegramMessageTo(chatId, 'Укажите цену в ₽ за кг (например: 1050).')
    return true
  }

  if (state.step === 'price') {
    const price = Number(text.trim().replace(',', '.').replace(/\s/g, ''))
    if (!Number.isFinite(price) || price < 0) {
      await sendTelegramMessageTo(chatId, 'Пришлите цену числом, например: 1050')
      return true
    }
    state.pricePerKg = price
    state.step = 'photo'
    addWizards.set(userId, state)
    await sendTelegramMessageTo(chatId, 'Отправьте одно фото товара.')
    return true
  }

  if (state.step === 'photo') {
    await sendTelegramMessageTo(chatId, 'Нужно фото. Отправьте изображение товара.')
    return true
  }

  if (state.step === 'category') {
    await sendTelegramMessageTo(chatId, 'Сначала выберите категорию кнопками ниже.', {
      reply_markup: categoryKeyboard(),
    })
    return true
  }

  return true
}

async function handleAddWizardPhoto(
  chatId: number,
  userId: number,
  photos: TelegramPhotoSize[],
): Promise<boolean> {
  const state = addWizards.get(userId)
  if (!state) return false

  if (state.step !== 'photo' || !state.category || !state.name || state.pricePerKg == null) {
    await sendTelegramMessageTo(
      chatId,
      'Сейчас фото не ожидается. Начните заново: /add',
    )
    return true
  }

  const best = photos.reduce((prev, cur) =>
    (cur.file_size ?? 0) >= (prev.file_size ?? 0) ? cur : prev,
  )

  try {
    const imageBuffer = await downloadTelegramFile(best.file_id)
    const product = addProduct({
      name: state.name,
      pricePerKg: state.pricePerKg,
      category: state.category,
      imageBuffer,
    })
    addWizards.delete(userId)
    await sendTelegramMessageTo(
      chatId,
      `Товар добавлен:\n${product.name} (${product.id})\n${product.pricePerKg} ₽/кг\nКатегория: ${product.category}`,
      { reply_markup: replyKeyboard(userId) },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    console.error('Add product failed:', message)
    await sendTelegramMessageTo(
      chatId,
      'Не удалось сохранить товар. Попробуйте другое фото или /add снова.',
    )
  }

  return true
}

async function handleAdminPriceCommands(
  chatId: number,
  userId: number | undefined,
  text: string,
): Promise<boolean> {
  const cmd = commandName(text)
  if (cmd !== '/prices' && cmd !== '/setprice') return false

  if (!isAdminUser(userId)) {
    await sendTelegramMessageTo(chatId, 'Команда доступна только администратору.')
    return true
  }

  if (cmd === '/prices') {
    await sendTelegramMessageTo(chatId, formatPricesList())
    return true
  }

  const match = text.trim().match(/^\/setprice(?:@\w+)?\s+(.+)\s+(\d+(?:[.,]\d+)?)\s*$/i)
  if (!match) {
    await sendTelegramMessageTo(
      chatId,
      'Формат: /setprice <id|название> <цена>\nПример: /setprice kuraga 1100\nили: /setprice Курага 1100',
    )
    return true
  }

  const query = match[1].trim()
  const price = Number(match[2].replace(',', '.'))

  try {
    const product = setProductPrice(query, price)
    await sendTelegramMessageTo(
      chatId,
      `Цена обновлена:\n${product.name} (${product.id}) — ${product.pricePerKg} ₽/кг`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    if (message === 'Product not found') {
      await sendTelegramMessageTo(chatId, 'Товар не найден. Смотрите список: /prices')
    } else {
      await sendTelegramMessageTo(chatId, 'Не удалось обновить цену. Проверьте значение.')
    }
  }

  return true
}

async function handlePrivateCommand(
  chatId: number,
  userId: number,
  rawText: string,
  chat: TelegramChat,
): Promise<boolean> {
  const mapped = mapButtonToCommand(rawText)
  const text = mapped ?? rawText
  const cmd = commandName(text)

  if (cmd === '/cancel') {
    await cancelWizards(chatId, userId)
    return true
  }

  if (deleteWizards.has(userId) && !text.startsWith('/')) {
    return handleDeleteWizardText(chatId, userId, text)
  }

  if (deleteWizards.has(userId) && cmd !== '/delete' && cmd !== '/help' && cmd !== '/cancel') {
    return handleDeleteWizardText(chatId, userId, text)
  }

  if (addWizards.has(userId) && !text.startsWith('/')) {
    return handleAddWizardText(chatId, userId, text)
  }

  if (addWizards.has(userId) && cmd !== '/add' && cmd !== '/help' && cmd !== '/cancel') {
    return handleAddWizardText(chatId, userId, text)
  }

  if (cmd === '/help') {
    await sendTelegramMessageTo(chatId, helpText(userId), {
      reply_markup: replyKeyboard(userId),
    })
    return true
  }

  if (cmd === '/shop' || cmd === '/store') {
    await sendShopMessage(chatId)
    return true
  }

  if (cmd === '/add') {
    if (!isAdminUser(userId)) {
      await sendTelegramMessageTo(chatId, 'Команда доступна только администратору.')
      return true
    }
    await startAddWizard(chatId, userId)
    return true
  }

  if (cmd === '/delete') {
    if (!isAdminUser(userId)) {
      await sendTelegramMessageTo(chatId, 'Команда доступна только администратору.')
      return true
    }
    const rest = text.replace(/^\/delete(?:@\w+)?\s*/i, '').trim()
    await startDeleteWizard(chatId, userId, rest || undefined)
    return true
  }

  const priceHandled = await handleAdminPriceCommands(chatId, userId, text)
  if (priceHandled) return true

  if (cmd === '/start' || cmd === '/id' || cmd === '/chatid') {
    const chatType = chat.type
    const title = chat.title ? ` (${chat.title})` : ''
    await sendTelegramMessageTo(
      chatId,
      `Chat id: ${chatId}\nТип: ${chatType}${title}\nВаш user id: ${userId}\n\nДля заказов: ADMIN_CHAT_ID=${chatId}\nДля цен: ADMIN_USER_IDS=${userId}\n\nПерезапустите сервер после правки .env.`,
      { reply_markup: replyKeyboard(userId) },
    )
    return true
  }

  return false
}

async function handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
  const userId = query.from.id
  const chatId = query.message?.chat.id
  const data = query.data ?? ''

  try {
    await telegramApi('answerCallbackQuery', { callback_query_id: query.id })
  } catch {
    /* ignore */
  }

  if (chatId == null) return

  if (!isAllowedUser(userId)) {
    await sendTelegramMessageTo(chatId, 'Доступ закрыт.')
    return
  }

  if (!isAdminUser(userId)) {
    await sendTelegramMessageTo(chatId, 'Команда доступна только администратору.')
    return
  }

  if (data.startsWith('delok:')) {
    const value = data.slice('delok:'.length)
    if (value === 'cancel') {
      await cancelWizards(chatId, userId)
      return
    }
    const state = deleteWizards.get(userId)
    if (!state?.product || state.product.id !== value) {
      deleteWizards.delete(userId)
      await sendTelegramMessageTo(chatId, 'Подтверждение устарело. Начните: /delete', {
        reply_markup: replyKeyboard(userId),
      })
      return
    }
    try {
      const removed = removeProduct(value)
      deleteWizards.delete(userId)
      await sendTelegramMessageTo(
        chatId,
        `Товар удалён:\n${removed.name} (${removed.id})`,
        { reply_markup: replyKeyboard(userId) },
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      console.error('Delete failed:', message)
      deleteWizards.delete(userId)
      await sendTelegramMessageTo(chatId, 'Не удалось удалить товар.', {
        reply_markup: replyKeyboard(userId),
      })
    }
    return
  }

  if (!data.startsWith('addcat:')) return

  const value = data.slice('addcat:'.length)
  if (value === 'cancel') {
    await cancelWizards(chatId, userId)
    return
  }

  if (value !== 'fruit' && value !== 'berries' && value !== 'nuts') return

  const state = addWizards.get(userId) ?? { step: 'category' as const }
  state.category = value
  state.step = 'name'
  addWizards.set(userId, state)
  await sendTelegramMessageTo(chatId, 'Введите название товара.')
}

async function deleteWebhook(): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=false`,
  )
  const data = (await response.json()) as { ok: boolean; description?: string }
  if (!data.ok) {
    console.error('deleteWebhook failed:', data.description ?? 'unknown error')
  }
}

async function pollBotUpdates(): Promise<void> {
  if (!BOT_TOKEN) return

  console.log('Bot polling starting…')
  try {
    await deleteWebhook()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'deleteWebhook error'
    console.error(message)
  }

  let offset = 0
  console.log('Bot polling ready. /help /id /prices /setprice /add /delete')

  for (;;) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeout: 25,
          offset,
          allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        }),
      })
      const data = (await response.json()) as {
        ok: boolean
        result?: TelegramUpdate[]
        description?: string
      }

      if (!data.ok || !data.result) {
        console.error('getUpdates failed:', data.description ?? 'unknown error')
        if (String(data.description ?? '').includes('Conflict')) {
          await deleteWebhook().catch(() => undefined)
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
        continue
      }

      for (const update of data.result) {
        offset = update.update_id + 1

        if (update.callback_query) {
          try {
            await handleCallbackQuery(update.callback_query)
          } catch (error) {
            const err = error instanceof Error ? error.message : 'callback failed'
            console.error(err)
          }
          continue
        }

        const memberUpdate = update.my_chat_member
        if (memberUpdate?.chat && memberUpdate.new_chat_member?.status) {
          const status = memberUpdate.new_chat_member.status
          if (status === 'member' || status === 'administrator') {
            const chat = memberUpdate.chat
            const title = chat.title ? ` (${chat.title})` : ''
            console.log(`Bot added to ${chat.type} ${chat.id}${title}`)
            try {
              await sendTelegramMessageTo(
                chat.id,
                `Бот добавлен в этот чат.\nChat id: ${chat.id}\n\nДля заказов в .env на сервере:\nADMIN_CHAT_ID=${chat.id}\n\nОткройте магазин кнопкой ниже или командой /shop`,
                { reply_markup: shopKeyboard() },
              )
            } catch (error) {
              const err = error instanceof Error ? error.message : 'send failed'
              console.error('Failed to announce group chat id:', err)
            }
          }
        }

        const message = update.message
        if (!message) continue

        const userId = message.from?.id
        if (message.chat.type === 'private') {
          if (!isAllowedUser(userId)) {
            try {
              await sendTelegramMessageTo(message.chat.id, 'Доступ закрыт.')
            } catch (error) {
              const err = error instanceof Error ? error.message : 'send failed'
              console.error('Failed to reject unauthorized user:', err)
            }
            continue
          }

          if (!userId) continue

          if (message.photo?.length) {
            try {
              const handled = await handleAddWizardPhoto(
                message.chat.id,
                userId,
                message.photo,
              )
              if (handled) continue
            } catch (error) {
              const err = error instanceof Error ? error.message : 'photo failed'
              console.error(err)
            }
            continue
          }

          if (!message.text) continue

          try {
            await handlePrivateCommand(message.chat.id, userId, message.text, message.chat)
          } catch (error) {
            const err = error instanceof Error ? error.message : 'command failed'
            console.error(err)
          }
          continue
        }

        if (!message.text) continue
        const cmd = commandName(message.text)

        if (cmd === '/shop' || cmd === '/store') {
          try {
            await sendShopMessage(message.chat.id)
          } catch (error) {
            const err = error instanceof Error ? error.message : 'shop failed'
            console.error(err)
          }
          continue
        }

        if (cmd !== '/start' && cmd !== '/id' && cmd !== '/chatid') continue
        if (!isAllowedUser(userId) && !isAdminUser(userId)) continue

        const chatId = message.chat.id
        const chatType = message.chat.type
        const title = message.chat.title ? ` (${message.chat.title})` : ''
        try {
          await sendTelegramMessageTo(
            chatId,
            `Chat id: ${chatId}\nТип: ${chatType}${title}\nВаш user id: ${userId ?? '—'}\n\nДля заказов: ADMIN_CHAT_ID=${chatId}\nДля цен: ADMIN_USER_IDS=${userId ?? ''}\n\nПерезапустите сервер после правки .env.`,
            { reply_markup: shopKeyboard() },
          )
        } catch (error) {
          const err = error instanceof Error ? error.message : 'send failed'
          console.error('Failed to reply to id command:', err)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'polling error'
      console.error('Bot polling error:', message)
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
  }
}

const app = express()
app.use(express.json({ limit: '100kb' }))

if (isDev) {
  app.use(cors({ origin: true }))
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/products', (_req, res) => {
  try {
    res.json({ products: readProducts() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'read failed'
    console.error('Products read failed:', message)
    res.status(500).json({ error: 'Не удалось загрузить каталог' })
  }
})

app.post('/api/orders', async (req, res) => {
  try {
    const body = req.body as OrderBody

    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Корзина пуста' })
      return
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const comment = typeof body.comment === 'string' ? body.comment : ''

    if (!name || !phone || !address) {
      res.status(400).json({ error: 'Укажите имя, телефон и адрес' })
      return
    }

    const catalog = readProducts()
    const resolvedItems: OrderItem[] = []

    for (const item of body.items) {
      if (
        !item ||
        typeof item.productId !== 'string' ||
        typeof item.quantityKg !== 'number' ||
        !Number.isFinite(item.quantityKg) ||
        item.quantityKg <= 0
      ) {
        res.status(400).json({ error: 'Некорректные позиции заказа' })
        return
      }

      const product = catalog.find((entry) => entry.id === item.productId)
      if (!product) {
        res.status(400).json({ error: 'Товар не найден в каталоге' })
        return
      }

      resolvedItems.push({
        productId: product.id,
        name: product.name,
        pricePerKg: product.pricePerKg,
        quantityKg: item.quantityKg,
      })
    }

    const initData = typeof body.initData === 'string' ? body.initData : ''
    let telegramUserId: number | undefined

    if (initData) {
      if (!BOT_TOKEN) {
        res.status(500).json({ error: 'Сервер не настроен' })
        return
      }
      const validation = validateInitData(initData, BOT_TOKEN)
      if (!validation.ok) {
        res.status(401).json({ error: 'Не удалось проверить пользователя Telegram' })
        return
      }
      telegramUserId = validation.userId
      if (!isAllowedUser(telegramUserId)) {
        res.status(403).json({ error: 'Доступ закрыт' })
        return
      }
    } else if (!isDev) {
      res.status(401).json({ error: 'Откройте магазин через Telegram' })
      return
    }

    const message = formatOrderMessage(
      { items: resolvedItems, name, phone, address, comment },
      telegramUserId,
    )

    await sendTelegramMessage(message)
    res.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка сервера'
    console.error('Order failed:', message)
    res.status(500).json({ error: 'Не удалось отправить заказ. Проверьте настройки бота.' })
  }
})

if (!isDev) {
  const distDir = path.join(rootDir, 'dist')
  app.use('/products', express.static(path.join(rootDir, 'public', 'products')))
  app.use(express.static(distDir))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
  if (!BOT_TOKEN) {
    console.warn('Warning: BOT_TOKEN missing in .env — bot will not reply to /start')
  } else {
    console.log(`BOT_TOKEN loaded (length ${BOT_TOKEN.length})`)
    void pollBotUpdates()
  }
  if (!ADMIN_CHAT_ID || ADMIN_CHAT_ID === '123456789') {
    console.warn('Warning: set a real ADMIN_CHAT_ID. Open the bot and send /start')
  }
  if (ADMIN_USER_IDS.length === 0) {
    console.warn('Warning: set ADMIN_USER_IDS in .env to edit prices via /setprice')
  } else {
    console.log(`Price admins: ${ADMIN_USER_IDS.length}`)
  }
  if (ALLOWED_USER_IDS.length === 0) {
    console.warn('Warning: ALLOWED_USER_IDS is empty — bot access is open')
  } else {
    console.log(`Allowed users: ${ALLOWED_USER_IDS.length}`)
  }
})
