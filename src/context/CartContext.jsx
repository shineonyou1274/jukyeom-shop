import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { shippingFeeFor } from '../lib/format'

const CartContext = createContext(null)
const KEY = 'jukyeom-cart'

function readCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

// 장바구니 항목: { id, name, price, image_url, quantity }
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
      add(product, quantity = 1) {
        setItems((prev) => {
          const found = prev.find((i) => i.id === product.id)
          if (found) return prev.map((i) => (i.id === product.id ? { ...i, quantity: Math.min(i.quantity + quantity, 99) } : i))
          const { id, name, price, image_url } = product
          return [...prev, { id, name, price, image_url, quantity }]
        })
      },
      setQuantity(id, quantity) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: Math.max(1, Math.min(99, quantity)) } : i)))
      },
      remove(id) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      },
      // 최신 가격/판매여부를 반영 (상품 목록을 받아와서 호출)
      sync(products) {
        setItems((prev) =>
          prev
            .map((i) => {
              const p = products.find((x) => x.id === i.id)
              return p ? { ...i, name: p.name, price: p.price, image_url: p.image_url } : null
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
