import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })

const token = (process.env.BOT_TOKEN || '').trim()
console.log('token_len', token.length)
if (!token) {
  console.error('BOT_TOKEN missing')
  process.exit(1)
}

async function call(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json()
}

const me = await call('getMe')
console.log('getMe', me.ok, me.result?.username ?? me.description)

const del = await call('deleteWebhook', { drop_pending_updates: false })
console.log('deleteWebhook', del.ok, del.description)

const up = await call('getUpdates', { timeout: 0, limit: 10, allowed_updates: ['message'] })
console.log('getUpdates', up.ok, 'count', up.result?.length ?? 0, up.description)
if (Array.isArray(up.result)) {
  for (const u of up.result) {
    console.log('update', u.update_id, u.message?.text, 'chat', u.message?.chat?.id)
  }
}
