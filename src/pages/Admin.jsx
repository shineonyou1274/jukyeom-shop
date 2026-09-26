import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callApi } from '../lib/api'
import { ORDER_STATUS, dateTime, phoneFormat, won } from '../lib/format'
import ProductImage from '../components/ProductImage'

export default function Admin() {
  const [tab, setTab] = useState('orders')
  return (
    <div className="container page">
      <h1>관리자</h1>
      <div className="tabs">
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>주문 관리</button>
        <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>상품 관리</button>
      </div>
      {tab === 'orders' ? <AdminOrders /> : <AdminProducts />}
    </div>
  )
}

// ───────────────────────── 주문 관리 ─────────────────────────
const FILTERS = [
  ['todo', '처리할 주문', ['paid', 'preparing']],
  ['deposit', '입금 대기', ['awaiting_deposit']],
  ['shipped', '배송중', ['shipped']],
  ['delivered', '배송 완료', ['delivered']],
  ['cancelled', '취소', ['cancelled']],
  ['all', '전체', ['awaiting_deposit', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']],
]

function AdminOrders() {
  const [filter, setFilter] = useState('todo')
  const [orders, setOrders] = useState(null)

  const load = useCallback(async () => {
    const statuses = FILTERS.find((f) => f[0] === filter)[2]
    const { data } = await supabase
      .from('orders').select('*, order_items(*)').in('status', statuses)
      .order('created_at', { ascending: false }).limit(200)
    setOrders(data || [])
  }, [filter])

  useEffect(() => { load() }, [load])

  const todaySales = (orders || [])
    .filter((o) => o.status !== 'cancelled' && new Date(o.paid_at).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + o.total_amount, 0)

  return (
    <>
      <div className="chips">
        {FILTERS.map(([key, label]) => (
          <button key={key} className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{label}</button>
        ))}
      </div>
      {filter === 'all' && orders && <p className="muted small">오늘 결제 금액: <b>{won(todaySales)}</b></p>}
      {!orders ? <p className="muted">불러오는 중…</p> : orders.length === 0 ? (
        <p className="muted">해당하는 주문이 없어요.</p>
      ) : (
        <ul className="order-list">{orders.map((o) => <AdminOrderCard key={o.id} order={o} onChange={load} />)}</ul>
      )}
    </>
  )
}

function AdminOrderCard({ order, onChange }) {
  const [tracking, setTracking] = useState(order.tracking_no || '')
  const [busy, setBusy] = useState(false)

  async function update(fields) {
    setBusy(true)
    const { error } = await supabase.from('orders').update(fields).eq('id', order.id)
    setBusy(false)
    if (error) alert(error.message)
    else onChange()
  }

  async function cancel() {
    const reason = prompt(order.status === 'awaiting_deposit' ? '취소 사유를 입력해 주세요.' : '취소 사유를 입력해 주세요. (고객에게 전액 환불돼요)', '고객 요청')
    if (reason === null) return
    setBusy(true)
    try {
      const { notice } = await callApi('payments/cancel', { orderId: order.id, reason })
      if (notice) alert(notice)
      onChange()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmDeposit() {
    if (!confirm(`${order.depositor_name} 님의 ${won(order.total_amount)} 입금을 확인하셨나요?`)) return
    setBusy(true)
    try {
      await callApi('deposits/confirm', { orderId: order.id })
      onChange()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="panel order">
      <div className="order-head">
        <div>
          <span className={`status s-${order.status}`}>{ORDER_STATUS[order.status]}</span>
          <span className="muted small"> {dateTime(order.paid_at || order.created_at)} · {order.order_no}</span>
        </div>
        <b>{won(order.total_amount)}</b>
      </div>
      <ul className="mini-list">
        {order.order_items.map((it) => (
          <li key={it.id}><span>{it.product_name} × {it.quantity}</span><span>{won(it.unit_price * it.quantity)}</span></li>
        ))}
      </ul>
      <div className="ship-box small">
        {!order.user_id && <><span className="status">비회원</span> 주문자 {order.orderer_name} · {phoneFormat(order.orderer_phone || '')}<br /></>}
        받는 분 <b>{order.receiver_name}</b> · {order.receiver_phone}
        <br />({order.zipcode}) {order.address1} {order.address2}
        {order.memo && <><br />메모: {order.memo}</>}
        <br /><span className="muted">결제: {order.payment_method}{order.depositor_name && ` · 입금자명 ${order.depositor_name}`}</span>
        {order.status === 'awaiting_deposit' && order.deposit_info && (
          <><br /><span className="muted">가상계좌 {order.deposit_info.bank} {order.deposit_info.accountNumber} (입금되면 자동 확인)</span></>
        )}
        {order.cancel_reason && <><br /><span className="muted">취소 사유: {order.cancel_reason}</span></>}
      </div>
      <div className="admin-actions">
        {order.status === 'awaiting_deposit' && order.payment_type === 'bank' && (
          <button className="btn btn-primary sm" disabled={busy} onClick={confirmDeposit}>입금 확인</button>
        )}
        {order.status === 'paid' && (
          <button className="btn btn-ghost sm" disabled={busy} onClick={() => update({ status: 'preparing' })}>상품 준비 시작</button>
        )}
        {['paid', 'preparing', 'shipped'].includes(order.status) && (
          <span className="inline-form">
            <input placeholder="송장번호" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            <button className="btn btn-primary sm" disabled={busy || !tracking.trim()}
              onClick={() => update({ status: 'shipped', tracking_no: tracking.trim() })}>
              {order.status === 'shipped' ? '송장 수정' : '발송 처리'}
            </button>
          </span>
        )}
        {order.status === 'shipped' && (
          <button className="btn btn-ghost sm" disabled={busy} onClick={() => update({ status: 'delivered' })}>배송 완료</button>
        )}
        {['awaiting_deposit', 'paid', 'preparing'].includes(order.status) && (
          <button className="btn btn-danger sm" disabled={busy} onClick={cancel}>{order.status === 'awaiting_deposit' ? '주문 취소' : '주문 취소·환불'}</button>
        )}
      </div>
    </li>
  )
}

// ───────────────────────── 상품 관리 ─────────────────────────
const EMPTY = { name: '', subtitle: '', description: '', price: '', stock: '', badge: '', image_url: '', is_active: true, sort_order: 0 }

function AdminProducts() {
  const [products, setProducts] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select('*').order('sort_order').order('id')
    setProducts(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  if (editing) {
    return <ProductForm initial={editing} onDone={() => { setEditing(null); load() }} />
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setEditing(EMPTY)}>+ 새 상품 등록</button>
      {!products ? <p className="muted">불러오는 중…</p> : (
        <ul className="admin-products">
          {products.map((p) => (
            <li key={p.id} className={`panel ${p.is_active ? '' : 'inactive'}`}>
              <div className="thumb"><ProductImage product={p} /></div>
              <div className="grow">
                <b>{p.name}</b> {!p.is_active && <span className="status s-cancelled">숨김</span>}
                <div className="small muted">{won(p.price)} · 재고 {p.stock}개</div>
              </div>
              <button className="btn btn-ghost sm" onClick={() => setEditing(p)}>수정</button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function ProductForm({ initial, onDone }) {
  const [form, setForm] = useState({ ...initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('사진은 5MB 이하로 올려 주세요.')
    setBusy(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return setError(error.message)
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setForm((f) => ({ ...f, image_url: data.publicUrl }))
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const row = {
      name: form.name.trim(),
      subtitle: form.subtitle?.trim() || null,
      description: form.description || null,
      price: Number(form.price),
      stock: Number(form.stock),
      badge: form.badge?.trim() || null,
      image_url: form.image_url || null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    }
    if (!row.name) return setError('상품명을 입력해 주세요.')
    if (!(row.price > 0)) return setError('가격을 입력해 주세요.')
    if (!(row.stock >= 0)) return setError('재고를 입력해 주세요.')
    setBusy(true)
    const { error } = initial.id
      ? await supabase.from('products').update(row).eq('id', initial.id)
      : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <form className="panel product-form" onSubmit={save}>
      <h2>{initial.id ? '상품 수정' : '새 상품 등록'}</h2>
      <div className="product-form-grid">
        <div>
          <ProductImage product={{ ...form, id: initial.id ?? 0 }} />
          <label className="btn btn-ghost block file-btn">
            사진 올리기
            <input type="file" accept="image/*" onChange={upload} hidden />
          </label>
          {form.image_url && <button type="button" className="link-btn muted small" onClick={() => setForm({ ...form, image_url: '' })}>사진 지우기</button>}
        </div>
        <div>
          <label>상품명<input value={form.name} onChange={set('name')} required /></label>
          <label>한 줄 설명 (용량 등)<input value={form.subtitle || ''} onChange={set('subtitle')} placeholder="예) 250g · 아홉 번 구운 자죽염" /></label>
          <div className="form-row two">
            <label>가격 (원)<input type="number" min="100" value={form.price} onChange={set('price')} required /></label>
            <label>재고 (개)<input type="number" min="0" value={form.stock} onChange={set('stock')} required /></label>
          </div>
          <div className="form-row two">
            <label>뱃지<input value={form.badge || ''} onChange={set('badge')} placeholder="예) 대표상품" /></label>
            <label>진열 순서<input type="number" value={form.sort_order} onChange={set('sort_order')} /></label>
          </div>
          <label>상세 설명<textarea rows={8} value={form.description || ''} onChange={set('description')} /></label>
          <label className="check"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> 판매중 (끄면 손님에게 안 보여요)</label>
          <p className="hint">※ 식품은 "병이 낫는다", "치료·예방" 같은 효능 표현을 쓰면 법 위반이에요. 원재료·제조방법·맛 위주로 적어 주세요.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="admin-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>취소</button>
      </div>
    </form>
  )
}
