import { HttpError, postHandler, requireUser, supabaseAdmin, tossAuthHeader } from '../_lib.js'

// 토스 결제창에서 돌아온 뒤 호출: 금액을 검증하고 토스에 최종 승인을 요청한다
export default postHandler(async (req, body) => {
  const user = await requireUser(req)
  const db = supabaseAdmin()
  const { paymentKey, orderId, amount } = body
  if (!paymentKey || !orderId) throw new HttpError(400, '결제 정보가 올바르지 않아요.')

  const { data: order } = await db.from('orders').select('*').eq('order_no', orderId).single()
  if (!order || order.user_id !== user.id) throw new HttpError(404, '주문을 찾을 수 없어요.')
  if (order.status !== 'pending') {
    // 새로고침 등으로 두 번 호출된 경우: 이미 처리된 주문이면 그대로 돌려준다
    if (order.payment_key === paymentKey) return { order }
    throw new HttpError(409, '이미 처리된 주문이에요.')
  }
  if (Number(amount) !== order.total_amount) throw new HttpError(400, '결제 금액이 주문 금액과 달라요.')

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: { Authorization: tossAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentKey, orderId, amount: order.total_amount }),
  })
  const payment = await tossRes.json()
  if (!tossRes.ok) {
    await db.from('orders').update({ status: 'failed' }).eq('id', order.id).eq('status', 'pending')
    throw new HttpError(400, payment.message || '결제 승인에 실패했어요.')
  }

  const { error } = await db.rpc('mark_order_paid', {
    p_order_id: order.id,
    p_payment_key: payment.paymentKey,
    p_method: payment.method + (payment.card?.company ? ` (${payment.card.company})` : ''),
    p_receipt_url: payment.receipt?.url ?? null,
  })
  if (error) throw error

  const { data: paid } = await db.from('orders').select('*').eq('id', order.id).single()
  return { order: paid }
})
