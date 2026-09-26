import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { PRODUCT_SELECT } from './product'

export function useProducts() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    supabase
      .from('products').select(PRODUCT_SELECT).eq('is_active', true)
      .order('sort_order').order('id')
      .then(({ data, error }) => (error ? setError(error.message) : setProducts(data)))
  }, [])
  return { products, error }
}
