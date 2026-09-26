import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'
import ProductImage from '../components/ProductImage'
import { won } from '../lib/format'
import { PRODUCT_SELECT, optionsOf, priceLabel } from '../lib/product'
import { usePageMeta } from '../lib/usePageMeta'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '../config/store'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const cart = useCart()
  const [product, setProduct] = useState()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [optionId, setOptionId] = useState(null)
  usePageMeta(product?.name, product ? `${product.name} ${product.subtitle || ''}`.trim() : undefined)

  useEffect(() => {
    supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle().then(({ data }) => {
      setProduct(data)
      // 재고 있는 첫 번째 용량을 기본 선택
      const first = optionsOf(data).find((o) => o.stock > 0)
      setOptionId(first?.id ?? null)
    })
  }, [id])

  if (product === undefined) return <div className="container page"><p className="muted">불러오는 중…</p></div>
  if (!product) return <div className="container page"><p>상품을 찾을 수 없어요. <Link to="/products">목록으로</Link></p></div>

  const options = optionsOf(product)
  const option = options.find((o) => o.id === optionId) || null
  const unitPrice = option ? option.price : product.price
  const stock = options.length ? (option?.stock ?? 0) : product.stock
  const soldOut = options.length ? options.every((o) => o.stock <= 0) : product.stock <= 0
  const canBuy = options.length ? Boolean(option && option.stock > 0) : !soldOut
  const maxQty = Math.min(stock, 99)
  const addToCart = () => cart.add(product, qty, option)

  return (
    <div className="container page">
      <div className="detail">
        <div className="detail-media"><ProductImage product={product} /></div>
        <div className="detail-info">
          {product.badge && <span className="tag inline">{product.badge}</span>}
          <h1>{product.name}</h1>
          {product.subtitle && <p className="muted">{product.subtitle}</p>}
          <p className="detail-price">{option ? won(option.price) : priceLabel(product)}</p>

          {options.length > 0 && (
            <div className="option-list" role="radiogroup" aria-label="용량 선택">
              {options.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={o.id === optionId}
                  className={o.id === optionId ? 'on' : ''} disabled={o.stock <= 0}
                  onClick={() => { setOptionId(o.id); setQty(1); setAdded(false) }}>
                  <span>{o.label}</span>
                  <b>{o.stock <= 0 ? '품절' : won(o.price)}</b>
                </button>
              ))}
            </div>
          )}

          <dl className="spec">
            <dt>배송비</dt>
            <dd>{won(SHIPPING_FEE)} ({won(FREE_SHIPPING_THRESHOLD)} 이상 무료)</dd>
            <dt>교환·환불</dt>
            <dd><Link to="/refund">교환·환불 정책 보기</Link></dd>
            <dt>재고</dt>
            <dd>{!canBuy ? '품절' : stock < 10 ? `${stock}개 남음` : '구매 가능'}</dd>
          </dl>

          {canBuy && (
            <div className="qty-row">
              <span>수량{option && <small className="muted"> · {option.label}</small>}</span>
              <Qty value={qty} max={maxQty} onChange={setQty} />
              <b>{won(unitPrice * qty)}</b>
            </div>
          )}

          <div className="detail-actions">
            <button className="btn btn-ghost" disabled={!canBuy} onClick={() => { addToCart(); setAdded(true) }}>
              장바구니 담기
            </button>
            <button className="btn btn-primary" disabled={!canBuy} onClick={() => { addToCart(); navigate('/cart') }}>
              {canBuy ? '바로 구매' : '품절'}
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

      {product.info_notice && (
        <section className="description">
          <h2>상품정보 제공고시</h2>
          <table className="info-table">
            <tbody>
              {product.info_notice.split('\n').filter((l) => l.trim()).map((line, i) => {
                const at = line.indexOf(':')
                return at > 0
                  ? <tr key={i}><th>{line.slice(0, at).trim()}</th><td>{line.slice(at + 1).trim()}</td></tr>
                  : <tr key={i}><td colSpan={2}>{line}</td></tr>
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="description">
        <h2>배송 · 교환 · 반품</h2>
        <ul className="ship-notes">
          <li>결제일로부터 토요일·공휴일을 제외하고 1~3일 안에 받아보실 수 있어요.</li>
          <li>택배비 {won(SHIPPING_FEE)} ({won(FREE_SHIPPING_THRESHOLD)} 이상 무료). 도서·산간 지역은 추가 배송비가 있을 수 있어요.</li>
          <li>받으신 날로부터 7일 이내 교환·반품 가능 (포장을 개봉해 사용한 경우 제외). <Link to="/refund">자세히 보기</Link></li>
        </ul>
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
