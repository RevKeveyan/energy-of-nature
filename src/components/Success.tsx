type Props = {
  onHome: () => void
}

export function Success({ onHome }: Props) {
  return (
    <section className="panel success">
      <h1>Заказ принят</h1>
      <p className="subtitle">Мы свяжемся с вами для подтверждения и оплаты.</p>
      <button type="button" className="btn btn-primary btn-block" onClick={onHome}>
        В каталог
      </button>
    </section>
  )
}
