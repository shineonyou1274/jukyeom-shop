import { FREE_SHIPPING_THRESHOLD, HttpError, SHIPPING_FEE, digits, optionalUser, postHandler, supabaseAdmin } from './_lib.js'
import { BANK } from '../src/config/store.js'
import { notifyOrder } from './_notify.js'

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
  const user = await optionalUser(req)
  // 비회원 주문: 주문 조회에 쓸 주문자 정보와 개인정보 수집 동의가 필요하다
  const guest = body.guest || {}
  if (!user) {
    if (!guest.agreePrivacy) throw new HttpError(400, '개인정보 수집·이용에 동의해 주세요.')
    if (digits(guest.phone).length < 10) throw new HttpError(400, '주문자 휴대폰 번호를 정확히 입력해 주세요.')
  }
  const db = supabaseAdmin()

  // 같은 상품·같은 옵션은 합친다. 용량 옵션이 있는 상품은 optionId가 꼭 필요하다
  const items = Array.isArray(body.items) ? body.items : []
  const merged = new Map()
  for (const it of items) {
    const productId = Number(it.productId)
    const optionId = it.optionId == null ? null : Number(it.optionId)
    const qty = Math.floor(Number(it.quantity))
    if (!Number.isInteger(productId) || (optionId !== null && !Number.isInteger(optionId)) || !(qty > 0) || qty > 99) {
      throw new HttpError(400, '주문 수량이 올바르지 않아요.')
    }
    const key = `${productId}:${optionId ?? ''}`
    const prev = merged.get(key)
    merged.set(key, { productId, optionId, quantity: (prev?.quantity || 0) + qty })
  }
  if (merged.size === 0) throw new HttpError(400, '장바구니가 비어 있어요.')

  const wanted = [...merged.values()]
  const { data: products, error } = await db
    .from('products').select('id, name, price, stock, is_active, product_options(id, label, price, stock, is_active)')
    .in('id', [...new Set(wanted.map((w) => w.productId))])
  if (error) throw error

  const lines = wanted.map(({ productId, optionId, quantity }) => {
    const p = products.find((x) => x.id === productId)
    if (!p || !p.is_active) throw new HttpError(400, '판매가 종료된 상품이 있어요. 장바구니를 확인해 주세요.')
    const options = p.product_options || []
    if (options.length > 0 || optionId !== null) {
      const o = options.find((x) => x.id === optionId)
      if (!o || !o.is_active) throw new HttpError(400, `'${p.name}'의 선택한 용량이 판매 종료됐어요. 장바구니를 확인해 주세요.`)
      if (o.stock < quantity) throw new HttpError(400, `'${p.name} ${o.label}' 재고가 부족해요. (남은 수량 ${o.stock}개)`)
      return { product_id: p.id, option_id: o.id, option_label: o.label, product_name: `${p.name} ${o.label}`, unit_price: o.price, quantity }
    }
    if (p.stock < quantity) throw new HttpError(400, `'${p.name}' 재고가 부족해요. (남은 수량 ${p.stock}개)`)
    return { product_id: p.id, product_name: p.name, unit_price: p.price, quantity }
  })

  const itemsAmount = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)
  const shippingFee = itemsAmount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const totalAmount = itemsAmount + shippingFee
  const orderName = lines.length > 1 ? `${lines[0].product_name} 외 ${lines.length - 1}건` : lines[0].product_name

  // card = 토스 결제위젯(카드·간편결제·가상계좌), bank = 가게 계좌로 직접 입금
  const bank = body.paymentType === 'bank'
  if (bank && !(BANK.enabled && BANK.account)) throw new HttpError(400, '무통장입금은 아직 준비 중이에요.')
  const depositorName = bank ? required(body.depositorName, '입금자명').slice(0, 30) : null

  const s = body.shipping || {}
  const { data: order, error: orderErr } = await db.from('orders').insert({
    order_no: makeOrderNo(),
    user_id: user?.id ?? null,
    orderer_name: user ? null : required(guest.name, '주문자 이름').slice(0, 30),
    orderer_phone: user ? null : digits(guest.phone),
    orderer_email: user ? user.email : String(guest.email ?? '').trim().slice(0, 100) || null,
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
    payment_type: bank ? 'bank' : 'card',
    ...(bank && { status: 'awaiting_deposit', payment_method: '무통장입금', depositor_name: depositorName }),
  }).select('id, order_no').single()
  if (orderErr) throw orderErr

  const { error: itemsErr } = await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })))
  if (itemsErr) {
    await db.from('orders').delete().eq('id', order.id)
    throw itemsErr
  }

  // 결제창을 닫아 버려진 주문서(결제 대기)는 하루가 지나면 정리한다
  await db.from('orders').delete().eq('status', 'pending').lt('created_at', new Date(Date.now() - 86400000).toISOString())

  // 무통장입금은 주문서가 만들어진 순간이 주문 접수다 (카드는 결제 승인 때 알린다)
  if (bank) await notifyOrder(order.id, 'awaiting')

  return { orderNo: order.order_no, orderName, amount: totalAmount }
})
