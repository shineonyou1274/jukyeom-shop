import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { shippingFeeFor } from '../lib/format'
import { optionsOf } from '../lib/product'

const CartContext = createContext(null)
const KEY = 'jukyeom-cart'
const keyOf = (id, optionId) => `${id}:${optionId ?? ''}`

function readCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v.map((i) => ({ ...i, key: i.key || keyOf(i.id, i.optionId) })) : []
  } catch {
    return []
  }
}

// 장바구니 항목: { key, id, optionId, optionLabel, name, price, image_url, quantity }
export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* 저장 불가 환경 무시 */ }
  }, [items])

  const value = useMemo(() => {
    const itemsAmount = items.reduce((s, i) => s + i.price * i.quantity, 0)
    const shippingFee = shippingFeeFor(itemsAmount)
    return {
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      itemsAmount,
      shippingFee,
      total: itemsAmount + shippingFee,
      add(product, quantity = 1, option = null) {
        const key = keyOf(product.id, option?.id)
        setItems((prev) => {
          const found = prev.find((i) => i.key === key)
          if (found) return prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, 99) } : i))
          return [...prev, {
            key,
            id: product.id,
            optionId: option?.id ?? null,
            optionLabel: option?.label ?? null,
            name: product.name,
            price: option?.price ?? product.price,
            image_url: product.image_url,
            quantity,
          }]
        })
      },
      setQuantity(key, quantity) {
        setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i)))
      },
      remove(key) {
        setItems((prev) => prev.filter((i) => i.key !== key))
      },
      // 최신 가격/판매여부를 반영 (옵션 포함 상품 목록을 받아와서 호출)
      sync(products) {
        setItems((prev) =>
          prev
            .map((i) => {
              const p = products.find((x) => x.id === i.id)
              if (!p) return null
              const opts = optionsOf(p)
              if (opts.length || i.optionId) {
                const o = opts.find((x) => x.id === i.optionId)
                return o ? { ...i, name: p.name, optionLabel: o.label, price: o.price, image_url: p.image_url } : null
              }
              return { ...i, name: p.name, price: p.price, image_url: p.image_url }
            })
            .filter(Boolean),
        )
      },
      clear() {
        setItems([])
      },
    }
  }, [items])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => useContext(CartContext)
