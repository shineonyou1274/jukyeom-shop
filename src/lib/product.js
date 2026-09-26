import { won } from './format'

// 용량 옵션이 있는 상품은 옵션의 가격·재고를, 없으면 상품 자체의 가격·재고를 쓴다
export const optionsOf = (p) =>
  (p?.product_options || []).filter((o) => o.is_active !== false).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)

// 목록용 가격: 용량이 여러 개면 가장 싼 용량 기준으로 "80g 28,000원~"
export function priceLabel(p) {
  const opts = optionsOf(p)
  if (opts.length === 0) return won(p.price)
  const cheapest = opts.reduce((a, b) => (b.price < a.price ? b : a))
  return opts.length > 1 ? `${cheapest.label} ${won(cheapest.price)}~` : won(cheapest.price)
}

export const stockOf = (p) => {
  const opts = optionsOf(p)
  return opts.length ? opts.reduce((s, o) => s + o.stock, 0) : p.stock
}

export const PRODUCT_SELECT = '*, product_options(*)'
