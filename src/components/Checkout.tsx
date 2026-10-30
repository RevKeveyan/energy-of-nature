import { useState, type FormEvent } from 'react'
import { formatPrice } from '../data/products'
import { useCart } from '../context/CartContext'

type Props = {
  onBack: () => void
  onSuccess: () => void
}

export function Checkout({ onBack, onSuccess }: Props) {
  const { items, totalRub, clear } = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('Заполните имя, телефон и адрес')
      return
    }

    if (items.length === 0) {
      setError('Корзина пуста')
      return
    }

    setLoading(true)
    try {
      const initData = window.Telegram?.WebApp?.initData ?? ''
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          comment: comment.trim(),
          initData,
          items: items.map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            pricePerKg: item.product.pricePerKg,
            quantityKg: item.quantityKg,
          })),
        }),
      })

      const data = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Не удалось отправить заказ')
      }

      clear()
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <button type="button" className="link-back" onClick={onBack}>
        ← Корзина
      </button>
      <h1>Оформление</h1>
      <p className="subtitle">Итого к оплате: {formatPrice(totalRub)}</p>

      <form className="checkout-form" onSubmit={handleSubmit}>
        <label>
          Имя
          <input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label>
          Телефон
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+7 ..."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>
        <label>
          Адрес / самовывоз
          <textarea
            name="address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </label>
        <label>
          Комментарий
          <textarea
            name="comment"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading ? 'Отправка…' : 'Отправить заказ'}
        </button>
      </form>
    </section>
  )
}
