import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type Product } from '../data/products'

export type CartItem = {
  product: Product
  quantityKg: number
}

type CartContextValue = {
  products: Product[]
  productsLoading: boolean
  productsError: string
  reloadProducts: () => Promise<void>
  items: CartItem[]
  addProduct: (productId: string, quantityKg?: number) => void
  setQuantity: (productId: string, quantityKg: number) => void
  removeProduct: (productId: string) => void
  clear: () => void
  totalRub: number
  totalItems: number
}

const CartContext = createContext<CartContextValue | null>(null)

const STEP_KG = 0.1

export function CartProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [items, setItems] = useState<CartItem[]>([])

  const reloadProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError('')
    try {
      const response = await fetch('/api/products')
      const data = (await response.json()) as { products?: Product[]; error?: string }
      if (!response.ok || !Array.isArray(data.products)) {
        throw new Error(data.error ?? 'Не удалось загрузить каталог')
      }
      setProducts(data.products)
    } catch (error) {
      setProductsError(error instanceof Error ? error.message : 'Ошибка загрузки')
      setProducts([])
    } finally {
      setProductsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadProducts()
  }, [reloadProducts])

  useEffect(() => {
    if (products.length === 0) return
    setItems((prev) =>
      prev
        .map((item) => {
          const fresh = products.find((product) => product.id === item.product.id)
          return fresh ? { ...item, product: fresh } : null
        })
        .filter((item): item is CartItem => item !== null),
    )
  }, [products])

  const value = useMemo<CartContextValue>(() => {
    const addProduct = (productId: string, quantityKg = STEP_KG) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return

      setItems((prev) => {
        const existing = prev.find((item) => item.product.id === productId)
        if (existing) {
          return prev.map((item) =>
            item.product.id === productId
              ? { ...item, quantityKg: Number((item.quantityKg + quantityKg).toFixed(1)) }
              : item,
          )
        }
        return [...prev, { product, quantityKg }]
      })
    }

    const setQuantity = (productId: string, quantityKg: number) => {
      const next = Number(quantityKg.toFixed(1))
      if (next <= 0) {
        setItems((prev) => prev.filter((item) => item.product.id !== productId))
        return
      }
      setItems((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantityKg: next } : item,
        ),
      )
    }

    const removeProduct = (productId: string) => {
      setItems((prev) => prev.filter((item) => item.product.id !== productId))
    }

    const clear = () => setItems([])

    const totalRub = items.reduce(
      (sum, item) => sum + item.product.pricePerKg * item.quantityKg,
      0,
    )
    const totalItems = items.length

    return {
      products,
      productsLoading,
      productsError,
      reloadProducts,
      items,
      addProduct,
      setQuantity,
      removeProduct,
      clear,
      totalRub,
      totalItems,
    }
  }, [items, products, productsError, productsLoading, reloadProducts])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider')
  }
  return ctx
}

export { STEP_KG }
