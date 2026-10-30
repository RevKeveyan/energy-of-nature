import { useEffect, useState } from 'react'
import { Cart } from './components/Cart'
import { Checkout } from './components/Checkout'
import { ProductList } from './components/ProductList'
import { Success } from './components/Success'
import { CartProvider } from './context/CartContext'
import './App.css'

type Screen = 'catalog' | 'cart' | 'checkout' | 'success'

function StoreApp() {
  const [screen, setScreen] = useState<Screen>('catalog')

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    webApp.ready()
    webApp.expand()
  }, [])

  return (
    <div className="app-shell">
      {screen === 'catalog' && (
        <ProductList onOpenCart={() => setScreen('cart')} />
      )}
      {screen === 'cart' && (
        <Cart
          onBack={() => setScreen('catalog')}
          onCheckout={() => setScreen('checkout')}
        />
      )}
      {screen === 'checkout' && (
        <Checkout
          onBack={() => setScreen('cart')}
          onSuccess={() => setScreen('success')}
        />
      )}
      {screen === 'success' && (
        <Success onHome={() => setScreen('catalog')} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <CartProvider>
      <StoreApp />
    </CartProvider>
  )
}
