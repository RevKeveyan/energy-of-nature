import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env') })

const token = (process.env.BOT_TOKEN || '').trim()
if (!token) {
  console.error('BOT_TOKEN missing')
  process.exit(1)
}

function api(method, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`
  const args = ['-4', '-sS', '-m', '20', '-H', 'Content-Type: application/json', '-d', JSON.stringify(body ?? {}), url]
  const out = execFileSync('curl.exe', args, { encoding: 'utf8' })
  return JSON.parse(out)
}

const me = api('getMe')
console.log('getMe_ok', me.ok, 'username', me.result?.username, 'desc', me.description)

const del = api('deleteWebhook', { drop_pending_updates: false })
console.log('deleteWebhook', del.ok, del.description)

const up = api('getUpdates', { timeout: 0, limit: 50, allowed_updates: ['message'] })
console.log('getUpdates_ok', up.ok, 'count', up.result?.length ?? 0, 'desc', up.description)

let chatId = null
if (Array.isArray(up.result)) {
  for (const u of up.result) {
    const id = u.message?.chat?.id
    console.log('msg', u.message?.text, 'chat', id)
    if (id) chatId = id
  }
}

if (chatId) {
  console.log('FOUND_CHAT_ID', chatId)
} else {
  console.log('NO_CHAT_ID_YET')
}
