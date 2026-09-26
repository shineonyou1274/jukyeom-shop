import { Link } from 'react-router-dom'
import ProductImage from './ProductImage'
import { priceLabel, stockOf } from '../lib/product'

export default function ProductCard({ product }) {
  const soldOut = stockOf(product) <= 0
  return (
    <Link to={`/products/${product.id}`} className="card">
      <div className="card-media">
        <ProductImage product={product} />
        {product.badge && <span className="tag">{product.badge}</span>}
        {soldOut && <span className="soldout">품절</span>}
      </div>
      <div className="card-body">
        <h3>{product.name}</h3>
        {product.subtitle && <p className="muted">{product.subtitle}</p>}
        <p className="price">{priceLabel(product)}</p>
      </div>
    </Link>
  )
}
