import { useMemo, useState } from 'react'
import { formatPrice, type ProductCategory } from '../data/products'
import { useCart } from '../context/CartContext'

type Props = {
  onOpenCart: () => void
}

type FilterId = 'all' | ProductCategory
type SortId = 'default' | 'price-asc' | 'price-desc'

const filters: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'fruit', label: 'Фруктовые' },
  { id: 'berries', label: 'Ягоды' },
  { id: 'nuts', label: 'Орехи' },
]

const sorts: { id: SortId; label: string }[] = [
  { id: 'default', label: 'По умолчанию' },
  { id: 'price-asc', label: 'Дешевле' },
  { id: 'price-desc', label: 'Дороже' },
]

export function ProductList({ onOpenCart }: Props) {
  const {
    products,
    productsLoading,
    productsError,
    reloadProducts,
    addProduct,
    items,
  } = useCart()
  const [filter, setFilter] = useState<FilterId>('all')
  const [sort, setSort] = useState<SortId>('default')

  const visibleProducts = useMemo(() => {
    const filtered =
      filter === 'all'
        ? [...products]
        : products.filter((product) => product.category === filter)

    if (sort === 'price-asc') {
      filtered.sort((a, b) => a.pricePerKg - b.pricePerKg)
    } else if (sort === 'price-desc') {
      filtered.sort((a, b) => b.pricePerKg - a.pricePerKg)
    }

    return filtered
  }, [filter, products, sort])

  return (
    <section className="catalog">
      <header className="catalog-header catalog-header--compact">
        <img
          className="brand-logo brand-logo--compact"
          src="/logo.jpg"
          alt="Энергия природы"
          width={120}
          height={120}
        />
        <p className="brand brand--compact">Энергия природы</p>
        <h1>Каталог сухофруктов и орехов</h1>

        <div className="hero-info">
          <p className="hero-info-title">Самовывоз</p>
          <p>
            <span className="hero-info-label">Адрес:</span> Рябиновая 65c2
          </p>
          <p>
            <span className="hero-info-label">Время работы:</span> 10:00–18:00
          </p>
          <p>Забрать готовый заказ можно на ресепшене</p>
          <p>
            <span className="hero-info-label">Телефон:</span>{' '}
            <a className="hero-info-phone" href="tel:+79263205985">
              +7 926 320-59-85
            </a>
          </p>
        </div>
      </header>

      <div className="catalog-filters" role="tablist" aria-label="Фильтр товаров">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className={
              filter === item.id
                ? 'filter-chip filter-chip--active'
                : 'filter-chip'
            }
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="catalog-sort" role="tablist" aria-label="Сортировка по цене">
        {sorts.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={sort === item.id}
            className={
              sort === item.id
                ? 'filter-chip filter-chip--active'
                : 'filter-chip'
            }
            onClick={() => setSort(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {productsLoading && <p className="subtitle">Загрузка каталога…</p>}
      {productsError && (
        <div className="catalog-error">
          <p className="form-error">{productsError}</p>
          <button type="button" className="btn btn-primary" onClick={() => void reloadProducts()}>
            Повторить
          </button>
        </div>
      )}

      {!productsLoading && !productsError && (
        <ul className="product-grid product-grid--cols3">
          {visibleProducts.map((product) => {
            const inCart = items.some((item) => item.product.id === product.id)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  className="product-card product-card--grid"
                  onClick={() => addProduct(product.id)}
                >
                  {product.image ? (
                    <img
                      className="product-visual product-visual--grid"
                      src={product.image}
                      alt=""
                    />
                  ) : (
                    <div
                      className="product-visual product-visual--grid"
                      style={{
                        background: `linear-gradient(145deg, ${product.accent}, #3b2418)`,
                      }}
                      aria-hidden
                    />
                  )}
                  <div className="product-body product-body--grid">
                    <h2>{product.name}</h2>
                    <p className="product-price">
                      {formatPrice(product.pricePerKg)}
                      <span> / кг</span>
                    </p>
                    <span className="product-add">{inCart ? '+' : 'В корзину'}</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {items.length > 0 && (
        <button type="button" className="fab" onClick={onOpenCart}>
          Корзина · {items.length}
        </button>
      )}
    </section>
  )
}
