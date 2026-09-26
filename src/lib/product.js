import { won } from './format'

// 용량 옵션이 있는 상품은 옵션의 가격·재고를, 없으면 상품 자체의 가격·재고를 쓴다
export const optionsOf = (p) =>
  (p?.product_options || []).filter((o) => o.is_active !== false).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)

export function priceLabel(p) {
  const opts = optionsOf(p)
  if (opts.length === 0) return won(p.price)
  const min = Math.min(...opts.map((o) => o.price))
  return opts.length > 1 ? `${won(min)}~` : won(min)
}

export const stockOf = (p) => {
  const opts = optionsOf(p)
  return opts.length ? opts.reduce((s, o) => s + o.stock, 0) : p.stock
}

export const PRODUCT_SELECT = '*, product_options(*)'
