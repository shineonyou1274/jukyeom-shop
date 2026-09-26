import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { callApi } from '../lib/api'
import { supabase } from '../lib/supabase'
import { searchAddress } from '../lib/postcode'
import { phoneFormat, won } from '../lib/format'
import { Summary } from './Cart'
import { BANK } from '../config/store'

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY

export default function Checkout() {
  const { user, profile } = useAuth()
  const cart = useCart()
  const widgetsRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saveAddress, setSaveAddress] = useState(true)
  const [method, setMethod] = useState('card') // card = 토스 결제위젯, bank = 무통장입금
  const [depositor, setDepositor] = useState('')
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', zipcode: '', address1: '', address2: '', memo: '' })

  // 회원정보의 기본 배송지 불러오기
  useEffect(() => {
    if (!profile) return
    setForm((f) => ({
      ...f,
      name: f.name || profile.name || '',
      phone: f.phone || profile.phone || '',
      zipcode: f.zipcode || profile.zipcode || '',
      address1: f.address1 || profile.address1 || '',
      address2: f.address2 || profile.address2 || '',
    }))
  }, [profile])

  // 토스 결제위젯 그리기
  useEffect(() => {
    if (!CLIENT_KEY || cart.items.length === 0) return
    let cancelled = false
    const rendered = []
    ;(async () => {
      try {
        const toss = await loadTossPayments(CLIENT_KEY)
        const widgets = toss.widgets({ customerKey: user.id })
        await widgets.setAmount({ currency: 'KRW', value: cart.total })
        if (cancelled) return
        const [methods, agreement] = await Promise.all([
          widgets.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
        ])
        rendered.push(methods, agreement)
        if (cancelled) return rendered.forEach((w) => w.destroy())
        widgetsRef.current = widgets
        setReady(true)
      } catch (e) {
        if (!cancelled) setError(e.message || '결제 화면을 불러오지 못했어요.')
      }
    })()
    return () => {
      cancelled = true
      rendered.forEach((w) => w.destroy?.())
      widgetsRef.current = null
      setReady(false)
    }
    // 위젯은 한 번만 그리고, 금액 변경은 아래 effect에서 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, cart.items.length === 0])

  useEffect(() => {
    widgetsRef.current?.setAmount({ currency: 'KRW', value: cart.total })
  }, [cart.total, ready])

  if (cart.items.length === 0) return <Navigate to="/cart" replace />

  const set = (k) => (e) => setForm({ ...form, [k]: k === 'phone' ? phoneFormat(e.target.value) : e.target.value })

  async function findAddress() {
    try {
      const addr = await searchAddress()
      setForm((f) => ({ ...f, ...addr, address2: '' }))
    } catch (e) {
      setError(e.message)
    }
  }

  async function pay(e) {
    e.preventDefault()
    setError('')
    if (!form.zipcode || !form.address1) return setError('주소 검색으로 배송지를 입력해 주세요.')
    if (form.phone.replace(/\D/g, '').length < 10) return setError('연락처를 정확히 입력해 주세요.')
    if (method === 'bank' && !(depositor || form.name).trim()) return setError('입금자명을 입력해 주세요.')
    setBusy(true)
    try {
      if (saveAddress) {
        const { name, phone, zipcode, address1, address2 } = form
        await supabase.from('profiles').update({ name, phone, zipcode, address1, address2 }).eq('id', user.id)
      }
      // 서버에서 DB 가격으로 주문서를 만들고, 그 금액으로 결제
      const order = await callApi('orders', {
        items: cart.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        shipping: form,
        paymentType: method,
        depositorName: depositor || form.name,
      })
      if (method === 'bank') {
        cart.clear()
        return navigate(`/order/complete/${order.orderNo}`, { replace: true })
      }
      const widgets = widgetsRef.current
      await widgets.setAmount({ currency: 'KRW', value: order.amount })
      await widgets.requestPayment({
        orderId: order.orderNo,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user.email,
        customerName: form.name,
        customerMobilePhone: form.phone.replace(/\D/g, ''),
      })
    } catch (e) {
      if (e.code !== 'USER_CANCEL') setError(e.message || '결제를 시작하지 못했어요.')
      setBusy(false)
    }
  }

  return (
    <div className="container page">
      <h1>주문/결제</h1>
      <form className="checkout-grid" onSubmit={pay}>
        <div>
          <section className="panel">
            <h2>배송지</h2>
            <div className="form-row two">
              <label>받는 분<input value={form.name} onChange={set('name')} required maxLength={30} /></label>
              <label>연락처<input value={form.phone} onChange={set('phone')} required inputMode="tel" placeholder="010-0000-0000" /></label>
            </div>
            <div className="form-row addr">
              <label>우편번호<input value={form.zipcode} readOnly placeholder="주소 검색" onClick={findAddress} /></label>
              <button type="button" className="btn btn-ghost" onClick={findAddress}>주소 검색</button>
            </div>
            <label>주소<input value={form.address1} readOnly onClick={findAddress} placeholder="주소 검색을 눌러 주세요" /></label>
            <label>상세주소<input value={form.address2} onChange={set('address2')} placeholder="동·호수 등" maxLength={100} /></label>
            <label>배송 메모<input value={form.memo} onChange={set('memo')} placeholder="예) 문 앞에 놓아 주세요" maxLength={200} /></label>
            <label className="check"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> 기본 배송지로 저장</label>
          </section>

          <section className="panel">
            <h2>주문 상품</h2>
            <ul className="mini-list">
              {cart.items.map((i) => (
                <li key={i.id}><span>{i.name} × {i.quantity}</span><b>{won(i.price * i.quantity)}</b></li>
              ))}
            </ul>
            <Link to="/cart" className="more">장바구니 수정</Link>
          </section>

          <section className="panel">
            <h2>결제 수단</h2>
            {BANK.account && (
              <div className="pay-methods" role="radiogroup" aria-label="결제 수단">
                <button type="button" role="radio" aria-checked={method === 'card'} className={method === 'card' ? 'on' : ''} onClick={() => setMethod('card')}>
                  카드 · 간편결제
                </button>
                <button type="button" role="radio" aria-checked={method === 'bank'} className={method === 'bank' ? 'on' : ''} onClick={() => setMethod('bank')}>
                  무통장입금
                </button>
              </div>
            )}
            {method === 'bank' && (
              <div className="bank-form">
                <p className="small">
                  <b>{BANK.bank} {BANK.account}</b> (예금주 {BANK.holder})
                  <br />주문 후 {BANK.dueDays}일 안에 입금해 주세요. 입금이 확인되면 발송 준비를 시작해요.
                </p>
                <label>입금자명<input value={depositor} onChange={(e) => setDepositor(e.target.value)} placeholder={form.name || '입금하실 분 이름'} maxLength={30} /></label>
              </div>
            )}
            {/* 토스 위젯은 한 번만 그려야 하므로 무통장입금 선택 시에도 지우지 않고 숨긴다 */}
            <div hidden={method === 'bank'}>
              {!CLIENT_KEY && <p className="error">VITE_TOSS_CLIENT_KEY가 설정되지 않았어요.</p>}
              <div id="payment-method" />
              <div id="agreement" />
            </div>
          </section>
        </div>

        <aside className="summary">
          <Summary itemsAmount={cart.itemsAmount} shippingFee={cart.shippingFee} total={cart.total} />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary block" disabled={(method === 'card' && !ready) || busy}>
            {busy ? '주문 처리 중…' : method === 'bank' ? `${won(cart.total)} 주문하기` : `${won(cart.total)} 결제하기`}
          </button>
          {method === 'bank' && <p className="hint">주문하기를 누르면 <Link to="/refund">교환·환불 정책</Link>에 동의한 것으로 봐요.</p>}
          {method === 'card' && CLIENT_KEY?.startsWith('test_') && (
            <p className="hint">지금은 <b>테스트 결제</b> 모드예요. 실제로 돈이 빠져나가지 않아요.</p>
          )}
        </aside>
      </form>
    </div>
  )
}
