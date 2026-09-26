import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ORDER_STATUS, dateTime, phoneFormat, won } from '../lib/format'
import { STORE } from '../config/store'

export default function MyPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [orders, setOrders] = useState(null)
  const [tab, setTab] = useState('orders')

  useEffect(() => {
    supabase
      .from('orders').select('*, order_items(*)')
      .neq('status', 'pending').neq('status', 'failed')
      .order('created_at', { ascending: false })
      .then(({ data }) => setOrders(data || []))
  }, [])

  return (
    <div className="container page">
      <h1>마이페이지</h1>
      <p className="muted">{profile?.name || user.email}님, 반가워요.</p>
      <div className="tabs">
        <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>주문 내역</button>
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>회원 정보</button>
      </div>

      {tab === 'orders' ? (
        !orders ? <p className="muted">불러오는 중…</p> : orders.length === 0 ? (
          <div className="panel center">
            <p className="muted">아직 주문 내역이 없어요.</p>
            <Link to="/products" className="btn btn-primary">상품 보러가기</Link>
          </div>
        ) : (
          <ul className="order-list">
            {orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </ul>
        )
      ) : (
        <ProfileForm profile={profile} userId={user.id} onSaved={refreshProfile} />
      )}
    </div>
  )
}

function OrderCard({ order }) {
  return (
    <li className="panel order">
      <div className="order-head">
        <div>
          <span className={`status s-${order.status}`}>{ORDER_STATUS[order.status]}</span>
          <span className="muted small"> {dateTime(order.created_at)} · {order.order_no}</span>
        </div>
        <b>{won(order.total_amount)}</b>
      </div>
      <ul className="mini-list">
        {order.order_items.map((it) => (
          <li key={it.id}><span>{it.product_name} × {it.quantity}</span><span>{won(it.unit_price * it.quantity)}</span></li>
        ))}
      </ul>
      <p className="small muted">
        {order.receiver_name} · {order.address1} {order.address2}
        {order.tracking_no && <> · 송장번호 <b>{order.tracking_no}</b></>}
      </p>
      <div className="order-foot small">
        {order.receipt_url && <a href={order.receipt_url} target="_blank" rel="noreferrer">영수증 보기</a>}
        {['paid', 'preparing'].includes(order.status) && (
          <span className="muted">취소를 원하시면 고객센터({STORE.phone})로 연락 주세요.</span>
        )}
      </div>
    </li>
  )
}

function ProfileForm({ profile, userId, onSaved }) {
  const [form, setForm] = useState({ name: profile?.name || '', phone: profile?.phone || '' })
  const [msg, setMsg] = useState('')
  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles').update(form).eq('id', userId)
    setMsg(error ? error.message : '저장했어요.')
    onSaved()
  }
  return (
    <form className="panel narrow-form" onSubmit={save}>
      <label>이름<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>휴대폰<input value={form.phone} onChange={(e) => setForm({ ...form, phone: phoneFormat(e.target.value) })} /></label>
      {profile?.address1 && <p className="small muted">기본 배송지: ({profile.zipcode}) {profile.address1} {profile.address2}</p>}
      {msg && <p className="notice">{msg}</p>}
      <button className="btn btn-primary">저장</button>
      <Link to="/reset-password" className="more">비밀번호 변경</Link>
    </form>
  )
}
