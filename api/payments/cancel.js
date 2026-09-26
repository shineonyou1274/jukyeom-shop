import { HttpError, postHandler, requireAdmin, supabaseAdmin, tossAuthHeader } from '../_lib.js'

// 관리자 전용: 결제 취소(전액 환불)
export default postHandler(async (req, body) => {
  await requireAdmin(req)
  const db = supabaseAdmin()
  const reason = String(body.reason || '판매자 취소').slice(0, 200)

  const { data: order } = await db.from('orders').select('*').eq('id', body.orderId).single()
  if (!order) throw new HttpError(404, '주문을 찾을 수 없어요.')
  if (!['paid', 'preparing'].includes(order.status) || !order.payment_key) {
    throw new HttpError(400, '결제 완료 또는 상품 준비중 주문만 취소할 수 있어요. (배송 시작 후에는 반품 처리)')
  }

  const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: tossAuthHeader(),
      'Content-Type': 'application/json',
      'Idempotency-Key': `cancel-${order.id}`,
    },
    body: JSON.stringify({ cancelReason: reason }),
  })
  const result = await tossRes.json()
  if (!tossRes.ok && result.code !== 'ALREADY_CANCELED_PAYMENT') {
    throw new HttpError(400, result.message || '결제 취소에 실패했어요.')
  }

  const { error } = await db.rpc('mark_order_cancelled', { p_order_id: order.id, p_reason: reason })
  if (error) throw error
  return { ok: true }
})
