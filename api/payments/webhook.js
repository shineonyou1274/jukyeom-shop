import { sendJson, readJson, supabaseAdmin, tossAuthHeader } from '../_lib.js'
import { notifyOrder } from '../_notify.js'

// 토스페이먼츠 웹훅: 가상계좌 입금·취소 등 결제 상태가 바뀌면 호출된다.
// 보낸 내용을 그대로 믿지 않고, 토스 API로 결제 상태를 다시 조회해서 반영한다.
export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'POST만 허용돼요.' })
  try {
    const body = await readJson(req)
    const orderId = body.orderId || body.data?.orderId
    if (!orderId) return sendJson(res, 200, { ok: true })

    const db = supabaseAdmin()
    const { data: order } = await db.from('orders').select('id, status, payment_type').eq('order_no', orderId).single()
    if (!order || order.payment_type !== 'card') return sendJson(res, 200, { ok: true })

    const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: tossAuthHeader() },
    })
    const payment = await tossRes.json()
    if (!tossRes.ok) throw new Error(payment.message || '결제 조회 실패')

    if (payment.status === 'DONE') {
      await db.rpc('mark_order_paid', {
        p_order_id: order.id, p_payment_key: payment.paymentKey, p_method: null, p_receipt_url: null,
      })
      // 가상계좌 입금처럼 이번에 처음 결제 완료가 된 경우에만 알린다
      if (order.status === 'awaiting_deposit') await notifyOrder(order.id, 'deposited')
    } else if (['CANCELED', 'ABORTED', 'EXPIRED'].includes(payment.status)) {
      const reason = payment.status === 'EXPIRED' ? '입금 기한 만료' : payment.cancels?.at(-1)?.cancelReason || '결제 취소'
      await db.rpc('mark_order_cancelled', { p_order_id: order.id, p_reason: reason })
    }
    sendJson(res, 200, { ok: true })
  } catch (err) {
    console.error(err)
    // 실패를 알려주면 토스가 나중에 다시 보내준다
    sendJson(res, 500, { message: err.message })
  }
}
