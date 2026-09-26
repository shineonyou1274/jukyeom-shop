import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import ProductImage from '../components/ProductImage'
import { won } from '../lib/format'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '../config/store'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const [product, setProduct] = useState()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').eq('id', id).maybeSingle().then(({ data }) => setProduct(data))
  }, [id])

  if (product === undefined) return <div className="container page"><p className="muted">불러오는 중…</p></div>
  if (!product) return <div className="container page"><p>상품을 찾을 수 없어요. <Link to="/products">목록으로</Link></p></div>

  const soldOut = product.stock <= 0
  const maxQty = Math.min(product.stock, 99)

  return (
    <div className="container page">
      <div className="detail">
        <div className="detail-media"><ProductImage product={product} /></div>
        <div className="detail-info">
          {product.badge && <span className="tag inline">{product.badge}</span>}
          <h1>{product.name}</h1>
          {product.subtitle && <p className="muted">{product.subtitle}</p>}
          <p className="detail-price">{won(product.price)}</p>

          <dl className="spec">
            <dt>배송비</dt>
            <dd>{won(SHIPPING_FEE)} ({won(FREE_SHIPPING_THRESHOLD)} 이상 무료)</dd>
            <dt>재고</dt>
            <dd>{soldOut ? '품절' : product.stock < 10 ? `${product.stock}개 남음` : '구매 가능'}</dd>
          </dl>

          {!soldOut && (
            <div className="qty-row">
              <span>수량</span>
              <Qty value={qty} max={maxQty} onChange={setQty} />
              <b>{won(product.price * qty)}</b>
            </div>
          )}

          <div className="detail-actions">
            <button className="btn btn-ghost" disabled={soldOut} onClick={() => { cart.add(product, qty); setAdded(true) }}>
              장바구니 담기
            </button>
            <button className="btn btn-primary" disabled={soldOut} onClick={() => { cart.add(product, qty); navigate('/cart') }}>
              {soldOut ? '품절' : '바로 구매'}
            </button>
          </div>
          {added && (
            <p className="notice">장바구니에 담았어요. <Link to="/cart">장바구니 보기 →</Link></p>
          )}
        </div>
      </div>

      <section className="description">
        <h2>상품 설명</h2>
        <p className="pre">{product.description || '상품 설명이 준비 중이에요.'}</p>
      </section>
    </div>
  )
}

export function Qty({ value, max = 99, onChange }) {
  return (
    <div className="qty">
      <button type="button" aria-label="수량 줄이기" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}>−</button>
      <span>{value}</span>
      <button type="button" aria-label="수량 늘리기" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}
