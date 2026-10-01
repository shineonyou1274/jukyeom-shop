import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { PRODUCT_SELECT, stockOf } from './product'

export function useProducts() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    supabase
      .from('products').select(PRODUCT_SELECT).eq('is_active', true)
      .order('sort_order').order('id')
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        // 품절 상품은 맨 뒤로 (같은 그룹 안에서는 원래 순서 유지)
        setProducts([...data].sort((a, b) => (stockOf(a) <= 0) - (stockOf(b) <= 0)))
      })
  }, [])
  return { products, error }
}
