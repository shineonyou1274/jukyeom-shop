import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import ProductImage from '../components/ProductImage'
import { Qty } from './ProductDetail'
import { won } from '../lib/format'
import { FREE_SHIPPING_THRESHOLD } from '../config/store'
import { PRODUCT_SELECT } from '../lib/product'

export default function Cart() {
  const cart = useCart()
  const navigate = useNavigate()
  const ids = cart.items.map((i) => i.id).join(',')

  // 담아둔 사이 가격이 바뀌었거나 판매 종료된 상품 반영
  useEffect(() => {
    if (!ids) return
    supabase.from('products').select(PRODUCT_SELECT).eq('is_active', true)
      .in('id', ids.split(',').map(Number))
      .then(({ data }) => data && cart.sync(data))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])

  if (cart.items.length === 0) {
    return (
      <div className="container page narrow center">
        <h1>장바구니</h1>
        <p className="muted">장바구니가 비어 있어요.</p>
        <Link to="/products" className="btn btn-primary">상품 보러가기</Link>
      </div>
    )
  }

  const remain = FREE_SHIPPING_THRESHOLD - cart.itemsAmount

  return (
    <div className="container page">
      <h1>장바구니</h1>
      <div className="checkout-grid">
        <ul className="cart-list">
          {cart.items.map((item) => (
            <li key={item.key} className="cart-item">
              <Link to={`/products/${item.id}`} className="thumb"><ProductImage product={item} /></Link>
              <div className="cart-item-info">
                <Link to={`/products/${item.id}`}><b>{item.name}</b></Link>
                {item.optionLabel && <span className="small">{item.optionLabel}</span>}
                <span className="muted">{won(item.price)}</span>
                <Qty value={item.quantity} onChange={(q) => cart.setQuantity(item.key, q)} />
              </div>
              <div className="cart-item-side">
                <b>{won(item.price * item.quantity)}</b>
                <button className="link-btn muted" onClick={() => cart.remove(item.key)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>

        <aside className="summary">
          <Summary itemsAmount={cart.itemsAmount} shippingFee={cart.shippingFee} total={cart.total} />
          {remain > 0 && <p className="hint">{won(remain)} 더 담으면 무료배송이에요.</p>}
          <button className="btn btn-primary block" onClick={() => navigate('/checkout')}>주문하기</button>
        </aside>
      </div>
    </div>
  )
}

export function Summary({ itemsAmount, shippingFee, total }) {
  return (
    <dl className="summary-list">
      <dt>상품 금액</dt><dd>{won(itemsAmount)}</dd>
      <dt>배송비</dt><dd>{shippingFee ? won(shippingFee) : '무료'}</dd>
      <dt className="total">결제 금액</dt><dd className="total">{won(total)}</dd>
    </dl>
  )
}
