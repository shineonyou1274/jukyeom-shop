import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DepositInfo from '../components/DepositInfo'
import { callApi } from '../lib/api'
import { useCart } from '../context/CartContext'
import { won } from '../lib/format'

export function PaymentSuccess() {
  const [params] = useSearchParams()
  const cart = useCart()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    callApi('payments/confirm', {
      paymentKey: params.get('paymentKey'),
      orderId: params.get('orderId'),
      amount: Number(params.get('amount')),
    })
      .then(({ order }) => { setOrder(order); cart.clear() })
      .catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="container page narrow center">
        <h1>결제를 완료하지 못했어요</h1>
        <p className="error">{error}</p>
        <Link to="/cart" className="btn btn-primary">장바구니로 돌아가기</Link>
      </div>
    )
  }
  if (!order) return <div className="container page narrow center"><p className="muted">결제를 확인하고 있어요…</p></div>

  return <OrderDone order={order} />
}

// 무통장입금 주문 직후 화면
export function OrderComplete() {
  const { orderNo } = useParams()
  const [order, setOrder] = useState()
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('orders').select('*').eq('order_no', orderNo).maybeSingle()
      if (data) return setOrder(data)
      // 비회원 주문: 주문할 때 입력한 휴대폰 번호로 조회
      let phone = ''
      try { phone = sessionStorage.getItem('guest-phone') || '' } catch { /* 무시 */ }
      if (!phone) return setOrder(null)
      callApi('order-lookup', { orderNo, phone }).then(({ order }) => setOrder(order)).catch(() => setOrder(null))
    })()
  }, [orderNo])
  if (order === undefined) return <div className="container page narrow center"><p className="muted">불러오는 중…</p></div>
  if (!order) return <div className="container page narrow center"><p>주문을 찾을 수 없어요. <Link to="/order/lookup">주문 조회</Link></p></div>
  return <OrderDone order={order} />
}

function OrderDone({ order }) {
  const waiting = order.status === 'awaiting_deposit'
  return (
    <div className="container page narrow center">
      <div className="done-mark">✓</div>
      <h1>{waiting ? '주문이 접수됐어요' : '주문이 완료됐어요'}</h1>
      <p className="muted">{waiting ? '아래 계좌로 입금해 주시면 정성껏 준비해서 보내드릴게요.' : '정성껏 준비해서 보내드릴게요.'}</p>
      {waiting && <DepositInfo order={order} />}
      <dl className="summary-list left">
        <dt>주문번호</dt><dd>{order.order_no}</dd>
        <dt>상품</dt><dd>{order.order_name}</dd>
        <dt>결제수단</dt><dd>{order.payment_method}</dd>
        <dt className="total">결제금액</dt><dd className="total">{won(order.total_amount)}</dd>
      </dl>
      {!order.user_id && (
        <p className="notice">비회원 주문이에요. <b>주문번호 {order.order_no}</b>와 휴대폰 번호로 주문을 조회할 수 있어요. 주문번호를 꼭 메모해 두세요.</p>
      )}
      <div className="hero-actions">
        <Link to={order.user_id ? '/mypage' : '/order/lookup'} className="btn btn-primary">{order.user_id ? '주문 내역 보기' : '비회원 주문조회'}</Link>
        <Link to="/" className="btn btn-ghost">홈으로</Link>
      </div>
    </div>
  )
}

export function PaymentFail() {
  const [params] = useSearchParams()
  const cancelled = params.get('code') === 'PAY_PROCESS_CANCELED'
  return (
    <div className="container page narrow center">
      <h1>{cancelled ? '결제를 취소했어요' : '결제에 실패했어요'}</h1>
      {!cancelled && <p className="error">{params.get('message')}</p>}
      <Link to="/checkout" className="btn btn-primary">다시 결제하기</Link>
    </div>
  )
}
