import { HttpError, postHandler, requireAdmin, supabaseAdmin } from '../_lib.js'

// 관리자 전용: 무통장입금 주문의 입금을 확인하고 결제 완료로 바꾼다
export default postHandler(async (req, body) => {
  await requireAdmin(req)
  const db = supabaseAdmin()
  const { data: order } = await db.from('orders').select('id, status, payment_type').eq('id', body.orderId).single()
  if (!order) throw new HttpError(404, '주문을 찾을 수 없어요.')
  if (order.payment_type !== 'bank' || order.status !== 'awaiting_deposit') {
    throw new HttpError(400, '입금 대기 중인 무통장입금 주문이 아니에요.')
  }
  const { error } = await db.rpc('mark_order_paid', {
    p_order_id: order.id, p_payment_key: null, p_method: '무통장입금', p_receipt_url: null,
  })
  if (error) throw error
  return { ok: true }
})
