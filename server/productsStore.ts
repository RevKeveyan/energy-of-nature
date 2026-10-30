import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ProductCategory = 'fruit' | 'berries' | 'nuts'

export type Product = {
  id: string
  name: string
  pricePerKg: number
  unit: string
  accent: string
  category: ProductCategory
  image?: string
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productsPath = path.join(rootDir, 'data', 'products.json')
export const productsImagesDir = path.join(rootDir, 'public', 'products')

const CATEGORY_ACCENT: Record<ProductCategory, string> = {
  fruit: '#c45c26',
  berries: '#b22222',
  nuts: '#8b5a2b',
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

function assertProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.pricePerKg === 'number' &&
    Number.isFinite(item.pricePerKg) &&
    typeof item.unit === 'string' &&
    typeof item.accent === 'string' &&
    (item.category === 'fruit' ||
      item.category === 'berries' ||
      item.category === 'nuts')
  )
}

export function readProducts(): Product[] {
  const raw = fs.readFileSync(productsPath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed) || !parsed.every(assertProduct)) {
    throw new Error('Invalid products.json')
  }
  return parsed
}

export function writeProducts(products: Product[]): void {
  fs.writeFileSync(productsPath, `${JSON.stringify(products, null, 2)}\n`, 'utf8')
}

export function findProduct(query: string): Product | undefined {
  const products = readProducts()
  const normalized = query.trim().toLowerCase()
  return products.find(
    (product) =>
      product.id.toLowerCase() === normalized ||
      product.name.toLowerCase() === normalized,
  )
}

export function setProductPrice(query: string, pricePerKg: number): Product {
  if (!Number.isFinite(pricePerKg) || pricePerKg < 0) {
    throw new Error('Invalid price')
  }

  const products = readProducts()
  const normalized = query.trim().toLowerCase()
  const index = products.findIndex(
    (product) =>
      product.id.toLowerCase() === normalized ||
      product.name.toLowerCase() === normalized,
  )

  if (index < 0) {
    throw new Error('Product not found')
  }

  const updated = {
    ...products[index],
    pricePerKg: Math.round(pricePerKg),
  }
  products[index] = updated
  writeProducts(products)
  return updated
}

export function slugifyProductName(name: string): string {
  const lower = name.trim().toLowerCase()
  let out = ''
  for (const char of lower) {
    if (TRANSLIT[char]) {
      out += TRANSLIT[char]
      continue
    }
    if (/[a-z0-9]/.test(char)) {
      out += char
      continue
    }
    if (char === ' ' || char === '-' || char === '_') {
      out += '-'
    }
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '')
  return out || `product-${Date.now()}`
}

export function addProduct(input: {
  name: string
  pricePerKg: number
  category: ProductCategory
  imageBuffer: Buffer
}): Product {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Invalid name')
  }
  if (!Number.isFinite(input.pricePerKg) || input.pricePerKg < 0) {
    throw new Error('Invalid price')
  }

  const products = readProducts()
  let id = slugifyProductName(name)
  const existingIds = new Set(products.map((product) => product.id))
  if (existingIds.has(id)) {
    let suffix = 2
    while (existingIds.has(`${id}-${suffix}`)) {
      suffix += 1
    }
    id = `${id}-${suffix}`
  }

  fs.mkdirSync(productsImagesDir, { recursive: true })
  const fileName = `${id}.jpg`
  const absolutePath = path.join(productsImagesDir, fileName)
  fs.writeFileSync(absolutePath, input.imageBuffer)

  const product: Product = {
    id,
    name,
    pricePerKg: Math.round(input.pricePerKg),
    unit: '1 кг',
    accent: CATEGORY_ACCENT[input.category],
    category: input.category,
    image: `/products/${fileName}`,
  }

  products.push(product)
  writeProducts(products)
  return product
}

export function removeProduct(query: string): Product {
  const products = readProducts()
  const normalized = query.trim().toLowerCase()
  const index = products.findIndex(
    (product) =>
      product.id.toLowerCase() === normalized ||
      product.name.toLowerCase() === normalized,
  )

  if (index < 0) {
    throw new Error('Product not found')
  }

  const [removed] = products.splice(index, 1)
  writeProducts(products)

  if (removed.image?.startsWith('/products/')) {
    const absolutePath = path.join(rootDir, 'public', removed.image.replace(/^\//, ''))
    if (absolutePath.startsWith(productsImagesDir) && fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }
  }

  return removed
}

export function formatPricesList(): string {
  const products = readProducts()
  const lines = products.map(
    (product) => `${product.id} — ${product.name}: ${product.pricePerKg} ₽/кг`,
  )
  return ['Текущие цены:', '', ...lines, '', 'Смена: /setprice <id|название> <цена>'].join(
    '\n',
  )
}
