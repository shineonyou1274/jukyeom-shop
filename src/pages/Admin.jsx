import { usePageMeta } from '../lib/usePageMeta'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { callApi } from '../lib/api'
import { COURIERS, ORDER_STATUS, dateTime, parseTracking, phoneFormat, won } from '../lib/format'
import ProductImage from '../components/ProductImage'
import { Stars } from '../components/Reviews'
import OrderAlerts from '../components/OrderAlerts'
import { PRODUCT_SELECT, priceLabel, stockOf } from '../lib/product'

export default function Admin() {
  usePageMeta('관리자')
  const [tab, setTab] = useState('orders')
  return (
    <div className="container page">
      <h1>관리자</h1>
      <OrderAlerts />
      <div className="tabs">
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>주문 관리</button>
        <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>상품 관리</button>
        <button className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>후기 관리</button>
      </div>
      {tab === 'orders' ? <AdminOrders /> : tab === 'products' ? <AdminProducts /> : <AdminReviews />}
    </div>
  )
}

// ───────────────────────── 주문 관리 ─────────────────────────
const TABS = [
  ['new', '새 주문', ['paid']],
  ['preparing', '준비중', ['preparing']],
  ['deposit', '입금 대기', ['awaiting_deposit']],
  ['shipped', '배송중', ['shipped']],
  ['delivered', '배송 완료', ['delivered']],
  ['cancelled', '취소', ['cancelled']],
  ['all', '전체', null],
]
const PERIODS = [['all', '전체 기간'], ['today', '오늘'], ['7', '최근 7일'], ['30', '최근 30일'], ['month', '이번 달']]

function inPeriod(o, period) {
  if (period === 'all') return true
  const t = new Date(o.created_at)
  const now = new Date()
  if (period === 'today') return t.toDateString() === now.toDateString()
  if (period === 'month') return t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth()
  return now - t <= Number(period) * 86400000
}

const searchText = (o) => [
  o.order_no, o.receiver_name, o.orderer_name, o.depositor_name, o.receiver_phone, o.orderer_phone,
  o.address1, o.tracking_no, ...o.order_items.map((i) => i.product_name),
].join(' ').replace(/-/g, '').toLowerCase()

// 택배 접수용 엑셀(CSV) 파일
function downloadCsv(list) {
  const rows = [['주문번호', '주문일', '상태', '받는분', '연락처', '우편번호', '주소', '상세주소', '상품', '수량', '결제금액', '배송메모', '송장']]
  for (const o of list) {
    rows.push([
      o.order_no, dateTime(o.created_at), ORDER_STATUS[o.status], o.receiver_name, o.receiver_phone, o.zipcode,
      o.address1, o.address2, o.order_items.map((i) => `${i.product_name} x${i.quantity}`).join(' / '),
      o.order_items.reduce((s, i) => s + i.quantity, 0), o.total_amount, o.memo, o.tracking_no,
    ])
  }
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `천왕봉죽염_주문_${new Date().toISOString().slice(0, 10)}.csv` })
  a.click()
  URL.revokeObjectURL(url)
}

function AdminOrders() {
  const [tab, setTab] = useState('new')
  const [period, setPeriod] = useState('all')
  const [query, setQuery] = useState('')
  const [orders, setOrders] = useState(null)
  const [openId, setOpenId] = useState(null)

  // 결제 대기·실패를 뺀 주문을 한 번에 불러와서 탭·기간·검색은 화면에서 거른다
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders').select('*, order_items(*)')
      .not('status', 'in', '(pending,failed)')
      .order('created_at', { ascending: false }).limit(1000)
    setOrders(data || [])
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  const all = orders || []
  const q = query.trim().replace(/-/g, '').toLowerCase()
  const scoped = all.filter((o) => inPeriod(o, period) && (!q || searchText(o).includes(q)))
  const statuses = TABS.find((t) => t[0] === tab)[2]
  const list = statuses ? scoped.filter((o) => statuses.includes(o.status)) : scoped
  const count = (st) => (st ? scoped.filter((o) => st.includes(o.status)).length : scoped.length)

  const isPaid = (o) => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status)
  const sum = (arr) => arr.reduce((s, o) => s + o.total_amount, 0)
  const today = all.filter((o) => isPaid(o) && inPeriod(o, 'today'))
  const month = all.filter((o) => isPaid(o) && inPeriod(o, 'month'))

  return (
    <>
      <div className="stat-row">
        <div><span>오늘 주문</span><b>{today.length}건</b><small>{won(sum(today))}</small></div>
        <div><span>이번 달 매출</span><b>{won(sum(month))}</b><small>{month.length}건</small></div>
        <div className={count(['paid']) ? 'alert' : ''}><span>발송할 주문</span><b>{all.filter((o) => ['paid', 'preparing'].includes(o.status)).length}건</b><small>새 주문 + 준비중</small></div>
        <div><span>입금 대기</span><b>{all.filter((o) => o.status === 'awaiting_deposit').length}건</b><small>무통장·가상계좌</small></div>
      </div>

      <div className="order-tools">
        <input type="search" placeholder="이름, 전화번호, 주문번호, 상품명 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="주문 검색" />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="기간">
          {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-ghost sm" onClick={load}>새로고침</button>
        <button className="btn btn-ghost sm" disabled={!list.length} onClick={() => downloadCsv(list)}>엑셀 내려받기</button>
      </div>

      <div className="chips">
        {TABS.map(([key, label, st]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>
            {label} <span className="chip-count">{count(st)}</span>
          </button>
        ))}
      </div>

      {!orders ? <p className="muted">불러오는 중…</p> : list.length === 0 ? (
        <p className="muted">해당하는 주문이 없어요.</p>
      ) : (
        <ul className="order-list">
          {list.map((o) => (
            <AdminOrderCard key={o.id} order={o} onChange={load}
              open={openId === o.id} onToggle={() => setOpenId(openId === o.id ? null : o.id)} />
          ))}
        </ul>
      )}
    </>
  )
}

function AdminOrderCard({ order, onChange, open, onToggle }) {
  const saved = parseTracking(order.tracking_no)
  const [tracking, setTracking] = useState(saved.number)
  const [courier, setCourier] = useState(() => {
    if (saved.courier) return saved.courier
    try { return localStorage.getItem('courier') || COURIERS[0] } catch { return COURIERS[0] }
  })
  function ship() {
    try { localStorage.setItem('courier', courier) } catch { /* 저장 안 돼도 괜찮음 */ }
    update({ status: 'shipped', tracking_no: `${courier} ${tracking.replace(/\s/g, '')}` })
  }
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
    <li className={`panel order admin-order${open ? ' open' : ''}`}>
      <button type="button" className="order-row" onClick={onToggle} aria-expanded={open}>
        <span className={`status s-${order.status}`}>{ORDER_STATUS[order.status]}</span>
        <span className="order-row-main">
          <b>{order.orderer_name || order.receiver_name}</b>
          <span className="muted">{order.order_items.length > 1 ? `${order.order_items[0].product_name} 외 ${order.order_items.length - 1}건` : order.order_items[0]?.product_name}</span>
        </span>
        <span className="order-row-side">
          <b>{won(order.total_amount)}</b>
          <small className="muted">{dateTime(order.created_at)}</small>
        </span>
      </button>
      {open && (<>
      <p className="muted small">{order.order_no}{order.paid_at && ` · 결제 ${dateTime(order.paid_at)}`}</p>
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
            <select value={courier} onChange={(e) => setCourier(e.target.value)} aria-label="택배사">
              {COURIERS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input placeholder="송장번호" inputMode="numeric" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            <button className="btn btn-primary sm" disabled={busy || !tracking.trim()} onClick={ship}>
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
      </>)}
    </li>
  )
}

// ───────────────────────── 상품 관리 ─────────────────────────
const EMPTY = { name: '', subtitle: '', description: '', info_notice: '', price: '', stock: '', badge: '', image_url: '', is_active: true, sort_order: 0 }

function AdminProducts() {
  const [products, setProducts] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('products').select(PRODUCT_SELECT).order('sort_order').order('id')
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
                <div className="small muted">
                  {priceLabel(p)} · 재고 {stockOf(p)}개
                  {p.product_options?.length > 0 && ` · 용량 ${p.product_options.length}종`}
                </div>
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
  // 용량 옵션: 있으면 옵션별 가격·재고로 판매하고, 상품 가격·재고는 자동 계산
  const [opts, setOpts] = useState(() =>
    [...(initial.product_options || [])].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map(({ id, label, price, stock }) => ({ id, label, price, stock })))
  const setOpt = (i, k, v) => setOpts(opts.map((o, j) => (j === i ? { ...o, [k]: v } : o)))
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
      info_notice: form.info_notice?.trim() || null,
      price: Number(form.price),
      stock: Number(form.stock),
      badge: form.badge?.trim() || null,
      image_url: form.image_url || null,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    }
    const cleanOpts = opts
      .map((o, i) => ({ id: o.id, label: String(o.label).trim(), price: Number(o.price), stock: Number(o.stock), sort_order: i }))
      .filter((o) => o.label || o.price)
    if (cleanOpts.some((o) => !o.label || !(o.price > 0) || !(o.stock >= 0))) return setError('용량 옵션의 이름·가격·재고를 모두 입력해 주세요.')
    if (cleanOpts.length) {
      row.price = Math.min(...cleanOpts.map((o) => o.price))
      row.stock = cleanOpts.reduce((s, o) => s + o.stock, 0)
    }
    if (!row.name) return setError('상품명을 입력해 주세요.')
    if (!(row.price > 0)) return setError('가격을 입력해 주세요.')
    if (!(row.stock >= 0)) return setError('재고를 입력해 주세요.')
    setBusy(true)
    try {
      const { data: saved, error } = initial.id
        ? await supabase.from('products').update(row).eq('id', initial.id).select('id').single()
        : await supabase.from('products').insert(row).select('id').single()
      if (error) throw error
      const keep = cleanOpts.filter((o) => o.id).map((o) => o.id)
      const removed = (initial.product_options || []).map((o) => o.id).filter((id) => !keep.includes(id))
      if (removed.length) {
        const { error: e1 } = await supabase.from('product_options').delete().in('id', removed)
        if (e1) throw e1
      }
      for (const { id, ...o } of cleanOpts) {
        const { error: e2 } = id
          ? await supabase.from('product_options').update(o).eq('id', id)
          : await supabase.from('product_options').insert({ ...o, product_id: saved.id })
        if (e2) throw e2
      }
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
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
          <div className="options-editor">
            <b className="small">용량 옵션</b> <span className="small muted">(용량별로 가격이 다르면 추가하세요. 없으면 아래 가격·재고로 판매)</span>
            {opts.length > 0 && (
              <div className="opt-row opt-head"><span>용량</span><span>가격(원)</span><span>재고</span><span /></div>
            )}
            {opts.map((o, i) => (
              <div key={o.id ?? `new-${i}`} className="opt-row">
                <input value={o.label} onChange={(e) => setOpt(i, 'label', e.target.value)} placeholder="예) 250g" />
                <input type="number" min="100" value={o.price} onChange={(e) => setOpt(i, 'price', e.target.value)} />
                <input type="number" min="0" value={o.stock} onChange={(e) => setOpt(i, 'stock', e.target.value)} />
                <button type="button" className="link-btn muted small" onClick={() => setOpts(opts.filter((_, j) => j !== i))}>삭제</button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost sm" onClick={() => setOpts([...opts, { label: '', price: '', stock: 0 }])}>+ 용량 추가</button>
          </div>
          {opts.length === 0 && (
            <div className="form-row two">
              <label>가격 (원)<input type="number" min="100" value={form.price} onChange={set('price')} required /></label>
              <label>재고 (개)<input type="number" min="0" value={form.stock} onChange={set('stock')} required /></label>
            </div>
          )}
          <div className="form-row two">
            <label>뱃지<input value={form.badge || ''} onChange={set('badge')} placeholder="예) 대표상품" /></label>
            <label>진열 순서<input type="number" value={form.sort_order} onChange={set('sort_order')} /></label>
          </div>
          <label>상세 설명<textarea rows={8} value={form.description || ''} onChange={set('description')} /></label>
          <label>상품정보 제공고시 (한 줄에 "항목: 내용")<textarea rows={6} value={form.info_notice || ''} onChange={set('info_notice')} placeholder={'식품의 유형: 기타가공품(죽염)\n내용량: 250g\n원재료명 및 함량: 천일염(국산) 100%'} /></label>
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

// ───────────────────────── 후기 관리 ─────────────────────────
function AdminReviews() {
  const [reviews, setReviews] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('reviews').select('*, products(name)').order('created_at', { ascending: false }).limit(200)
    setReviews(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function toggle(r) {
    const { error } = await supabase.rpc('set_review_hidden', { p_id: r.id, p_hidden: !r.is_hidden })
    if (error) alert(error.message)
    load()
  }
  async function remove(r) {
    if (!confirm('이 후기를 완전히 삭제할까요? (숨기기를 권해요)')) return
    const { error } = await supabase.from('reviews').delete().eq('id', r.id)
    if (error) alert(error.message)
    load()
  }

  if (!reviews) return <p className="muted">불러오는 중…</p>
  if (reviews.length === 0) return <p className="muted">아직 후기가 없어요.</p>
  return (
    <ul className="order-list">
      {reviews.map((r) => (
        <li key={r.id} className={`panel ${r.is_hidden ? 'inactive' : ''}`}>
          <div className="order-head">
            <div>
              <Stars value={r.rating} /> <b>{r.products?.name}</b>
              <span className="muted small"> · {r.author_name} · {dateTime(r.created_at)}</span>
              {r.is_hidden && <span className="status s-cancelled"> 숨김</span>}
            </div>
          </div>
          <p className="pre">{r.content}</p>
          {r.image_url && <img src={r.image_url} alt="" className="review-thumb" />}
          <div className="admin-actions">
            <button className="btn btn-ghost sm" onClick={() => toggle(r)}>{r.is_hidden ? '다시 보이기' : '숨기기'}</button>
            <button className="btn btn-danger sm" onClick={() => remove(r)}>삭제</button>
          </div>
        </li>
      ))}
    </ul>
  )
}
