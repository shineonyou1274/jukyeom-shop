import { HttpError, postHandler, requireAdmin, supabaseAdmin, tossAuthHeader } from '../_lib.js'

// 관리자 전용: 주문 취소(전액 환불)
export default postHandler(async (req, body) => {
  await requireAdmin(req)
  const db = supabaseAdmin()
  const reason = String(body.reason || '판매자 취소').slice(0, 200)

  const { data: order } = await db.from('orders').select('*').eq('id', body.orderId).single()
  if (!order) throw new HttpError(404, '주문을 찾을 수 없어요.')
  if (!['awaiting_deposit', 'paid', 'preparing'].includes(order.status)) {
    throw new HttpError(400, '입금 대기·결제 완료·상품 준비중 주문만 취소할 수 있어요. (배송 시작 후에는 반품 처리)')
  }

  let notice = ''
  if (order.payment_type === 'bank') {
    // 무통장입금: 토스를 거치지 않으므로 이미 입금된 돈은 직접 돌려드려야 한다
    if (order.status !== 'awaiting_deposit') notice = '입금받은 금액은 고객 계좌로 직접 환불해 주세요.'
  } else {
    const paidVirtualAccount = order.payment_method?.startsWith('가상계좌') && order.status !== 'awaiting_deposit'
    if (paidVirtualAccount) {
      throw new HttpError(400, '가상계좌로 입금이 끝난 주문은 환불받을 계좌가 필요해요. 토스페이먼츠 상점관리자에서 취소해 주시면 여기에도 자동으로 반영돼요.')
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
  }

  const { error } = await db.rpc('mark_order_cancelled', { p_order_id: order.id, p_reason: reason })
  if (error) throw error
  return { ok: true, notice }
})
