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

export function formatPrice(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`
}
