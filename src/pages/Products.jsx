import ProductCard from '../components/ProductCard'
import { useProducts } from '../lib/useProducts'

export default function Products() {
  const { products, error } = useProducts()
  return (
    <div className="container page">
      <h1>전체상품</h1>
      {error && <p className="error">{error}</p>}
      {!products ? (
        <p className="muted">불러오는 중…</p>
      ) : products.length === 0 ? (
        <p className="muted">등록된 상품이 없어요.</p>
      ) : (
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      )}
    </div>
  )
}
