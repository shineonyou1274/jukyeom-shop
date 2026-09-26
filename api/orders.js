import { FREE_SHIPPING_THRESHOLD, HttpError, SHIPPING_FEE, postHandler, requireUser, supabaseAdmin } from './_lib.js'

function makeOrderNo() {
  const d = new Date(Date.now() + 9 * 3600 * 1000) // KST
  const ymd = d.toISOString().slice(0, 10).replaceAll('-', '')
  const rand = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  return `JY${ymd}-${rand}`
}

const required = (v, label) => {
  const s = String(v ?? '').trim()
  if (!s) throw new HttpError(400, `${label}을(를) 입력해 주세요.`)
  return s
}

// 주문 생성: 가격은 반드시 DB 기준으로 서버에서 계산한다 (브라우저 값은 믿지 않음)
export default postHandler(async (req, body) => {
  const user = await requireUser(req)
  const db = supabaseAdmin()

  const items = Array.isArray(body.items) ? body.items : []
  const merged = new Map()
  for (const it of items) {
    const id = Number(it.productId)
    const qty = Math.floor(Number(it.quantity))
    if (!Number.isInteger(id) || !(qty > 0) || qty > 99) throw new HttpError(400, '주문 수량이 올바르지 않아요.')
    merged.set(id, (merged.get(id) || 0) + qty)
  }
  if (merged.size === 0) throw new HttpError(400, '장바구니가 비어 있어요.')

  const { data: products, error } = await db
    .from('products').select('id, name, price, stock, is_active').in('id', [...merged.keys()])
  if (error) throw error

  const lines = [...merged].map(([id, quantity]) => {
    const p = products.find((x) => x.id === id)
    if (!p || !p.is_active) throw new HttpError(400, '판매가 종료된 상품이 있어요. 장바구니를 확인해 주세요.')
    if (p.stock < quantity) throw new HttpError(400, `'${p.name}' 재고가 부족해요. (남은 수량 ${p.stock}개)`)
    return { product_id: p.id, product_name: p.name, unit_price: p.price, quantity }
  })

  const itemsAmount = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const shippingFee = itemsAmount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const totalAmount = itemsAmount + shippingFee
  const orderName = lines.length > 1 ? `${lines[0].product_name} 외 ${lines.length - 1}건` : lines[0].product_name

  const s = body.shipping || {}
  const { data: order, error: orderErr } = await db.from('orders').insert({
    order_no: makeOrderNo(),
    user_id: user.id,
    order_name: orderName.slice(0, 100),
    items_amount: itemsAmount,
    shipping_fee: shippingFee,
    total_amount: totalAmount,
    receiver_name: required(s.name, '받는 분 이름'),
    receiver_phone: required(s.phone, '연락처'),
    zipcode: required(s.zipcode, '우편번호'),
    address1: required(s.address1, '주소'),
    address2: String(s.address2 ?? '').trim(),
    memo: String(s.memo ?? '').trim().slice(0, 200),
  }).select('id, order_no').single()
  if (orderErr) throw orderErr

  const { error: itemsErr } = await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })))
  if (itemsErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw itemsErr
  }

  return { orderNo: order.order_no, orderName, amount: totalAmount }
})
