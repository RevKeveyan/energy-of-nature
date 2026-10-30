import { formatPrice } from '../data/products'
import { STEP_KG, useCart } from '../context/CartContext'

type Props = {
  onBack: () => void
  onCheckout: () => void
}

export function Cart({ onBack, onCheckout }: Props) {
  const { items, setQuantity, removeProduct, clear, totalRub } = useCart()

  if (items.length === 0) {
    return (
      <section className="panel">
        <button type="button" className="link-back" onClick={onBack}>
          ← Каталог
        </button>
        <h1>Корзина пуста</h1>
        <p className="subtitle">Добавьте товары из каталога.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <button type="button" className="link-back" onClick={onBack}>
        ← Каталог
      </button>
      <h1>Корзина</h1>

      <ul className="cart-list">
        {items.map((item) => {
          const lineTotal = item.product.pricePerKg * item.quantityKg
          return (
            <li key={item.product.id} className="cart-row">
              <div>
                <strong>{item.product.name}</strong>
                <p>{formatPrice(item.product.pricePerKg)} / кг</p>
              </div>
              <div className="qty-controls">
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label="Меньше"
                  onClick={() =>
                    setQuantity(item.product.id, item.quantityKg - STEP_KG)
                  }
                >
                  −
                </button>
                <span>{item.quantityKg} кг</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label="Больше"
                  onClick={() =>
                    setQuantity(item.product.id, item.quantityKg + STEP_KG)
                  }
                >
                  +
                </button>
              </div>
              <div className="cart-line-total">
                <span>{formatPrice(lineTotal)}</span>
                <button
                  type="button"
                  className="link-danger"
                  onClick={() => removeProduct(item.product.id)}
                >
                  Удалить
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="total-bar">
        <span>Итого</span>
        <strong>{formatPrice(totalRub)}</strong>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={onCheckout}>
        Оформить заказ
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={clear}>
        Очистить корзину
      </button>
    </section>
  )
}
