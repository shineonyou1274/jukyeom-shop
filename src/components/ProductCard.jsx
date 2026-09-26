import { Link } from 'react-router-dom'
import ProductImage from './ProductImage'
import { won } from '../lib/format'

export default function ProductCard({ product }) {
  const soldOut = product.stock <= 0
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
        <p className="price">{won(product.price)}</p>
      </div>
    </Link>
  )
}
