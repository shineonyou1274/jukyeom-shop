import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ANONYMOUS, loadTossPayments } from '@tosspayments/tosspayments-sdk'
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
  const { user, loading } = useAuth()
  const cart = useCart()
  const [guestMode, setGuestMode] = useState(false)

  if (cart.items.length === 0) return <Navigate to="/cart" replace />
  if (loading) return <div className="container page"><p className="muted">불러오는 중…</p></div>
  if (!user && !guestMode) {
    return (
      <div className="container page auth center">
        <h1>주문하기</h1>
        <div className="panel">
          <p>회원이시면 로그인하고 주문하시면 주문 내역을 편하게 볼 수 있어요.</p>
          <Link to="/login?next=/checkout" className="btn btn-primary block">로그인하고 주문하기</Link>
          <button type="button" className="btn btn-ghost block guest-btn" onClick={() => setGuestMode(true)}>비회원으로 주문하기</button>
          <p className="small muted">아직 회원이 아니신가요? <Link to="/signup?next=/checkout">회원가입</Link></p>
        </div>
      </div>
    )
  }
  return <CheckoutForm />
}

function CheckoutForm() {
  const { user, profile } = useAuth()
  const cart = useCart()
  const customerKey = user?.id ?? ANONYMOUS
  const [guest, setGuest] = useState({ name: '', phone: '', email: '', agreePrivacy: false })
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
        const widgets = toss.widgets({ customerKey })
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
  }, [customerKey, cart.items.length === 0])

  useEffect(() => {
    widgetsRef.current?.setAmount({ currency: 'KRW', value: cart.total })
  }, [cart.total, ready])

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
    if (!user) {
      if (!guest.name.trim()) return setError('주문자 이름을 입력해 주세요.')
      if (guest.phone.replace(/\D/g, '').length < 10) return setError('주문자 휴대폰 번호를 정확히 입력해 주세요.')
      if (!guest.agreePrivacy) return setError('비회원 주문을 위한 개인정보 수집·이용에 동의해 주세요.')
    }
    setBusy(true)
    try {
      if (user && saveAddress) {
        const { name, phone, zipcode, address1, address2 } = form
        await supabase.from('profiles').update({ name, phone, zipcode, address1, address2 }).eq('id', user.id)
      }
      // 서버에서 DB 가격으로 주문서를 만들고, 그 금액으로 결제
      const order = await callApi('orders', {
        items: cart.items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        shipping: form,
        paymentType: method,
        depositorName: depositor || form.name,
        ...(!user && { guest }),
      })
      // 비회원은 주문 완료·조회 화면에서 휴대폰 번호로 주문을 확인한다
      if (!user) {
        try { sessionStorage.setItem('guest-phone', guest.phone) } catch { /* 저장 불가 환경 무시 */ }
      }
      if (method === 'bank') {
        navigate(`/order/complete/${order.orderNo}`, { replace: true })
        return cart.clear()
      }
      const widgets = widgetsRef.current
      await widgets.setAmount({ currency: 'KRW', value: order.amount })
      await widgets.requestPayment({
        orderId: order.orderNo,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: user?.email || guest.email || undefined,
        customerName: user ? form.name : guest.name,
        customerMobilePhone: (user ? form.phone : guest.phone).replace(/\D/g, ''),
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
          {!user && (
            <section className="panel">
              <h2>주문자 정보 <span className="small muted">(비회원)</span></h2>
              <div className="form-row two">
                <label>이름<input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} required maxLength={30} autoComplete="name" /></label>
                <label>휴대폰<input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: phoneFormat(e.target.value) })} required inputMode="tel" placeholder="010-0000-0000" autoComplete="tel" /></label>
              </div>
              <label>이메일 (선택 · 결제 영수증을 받을 수 있어요)<input type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} autoComplete="email" /></label>
              <p className="hint">주문번호와 이 휴대폰 번호로 <b>비회원 주문조회</b>를 할 수 있어요.</p>
              <div className="agree">
                <label className="check">
                  <input type="checkbox" checked={guest.agreePrivacy} onChange={(e) => setGuest({ ...guest, agreePrivacy: e.target.checked })} />
                  (필수) 비회원 주문을 위한 개인정보 수집·이용 동의
                </label>
                <p className="small muted agree-detail">
                  수집 항목: 주문자 이름·휴대폰·이메일, 받는 분 이름·연락처·주소 / 목적: 주문 처리·배송·주문 조회 /
                  보유 기간: 전자상거래법에 따라 5년. <Link to="/privacy" target="_blank">개인정보처리방침</Link>
                </p>
              </div>
            </section>
          )}
          <section className="panel">
            <h2>배송지</h2>
            {!user && (
              <button type="button" className="link-btn small copy-orderer" onClick={() => setForm({ ...form, name: guest.name, phone: guest.phone })}>
                주문자와 같아요
              </button>
            )}
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
            {user && <label className="check"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> 기본 배송지로 저장</label>}
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
            {BANK.enabled && BANK.account && (
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
