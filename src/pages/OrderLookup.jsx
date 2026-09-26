import { useState } from 'react'
import { Link } from 'react-router-dom'
import { callApi } from '../lib/api'
import { phoneFormat } from '../lib/format'
import { OrderCard } from './MyPage'

// 비회원 주문조회: 주문번호 + 주문자 휴대폰 번호
export default function OrderLookup() {
  const [orderNo, setOrderNo] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { order } = await callApi('order-lookup', { orderNo, phone })
      setOrder(order)
    } catch (err) {
      setOrder(null)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container page narrow">
      <h1>비회원 주문조회</h1>
      <form onSubmit={submit} className="panel">
        <label>주문번호<input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="예) JY20261001-XXXXXXXXXX" required /></label>
        <label>주문자 휴대폰<input value={phone} onChange={(e) => setPhone(phoneFormat(e.target.value))} inputMode="tel" placeholder="010-0000-0000" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary block" disabled={busy}>{busy ? '조회 중…' : '주문 조회'}</button>
        <p className="small muted">회원이시면 <Link to="/login?next=/mypage">로그인</Link> 후 마이페이지에서 확인하세요.</p>
      </form>
      {order && <ul className="order-list"><OrderCard order={order} /></ul>}
    </div>
  )
}
