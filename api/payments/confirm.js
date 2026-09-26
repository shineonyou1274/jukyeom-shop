import { HttpError, optionalUser, postHandler, supabaseAdmin, tossAuthHeader } from '../_lib.js'
import { bankName } from '../_banks.js'
import { notifyOrder } from '../_notify.js'

// 토스 결제창에서 돌아온 뒤 호출: 금액을 검증하고 토스에 최종 승인을 요청한다
export default postHandler(async (req, body) => {
  const user = await optionalUser(req)
  const db = supabaseAdmin()
  const { paymentKey, orderId, amount } = body
  if (!paymentKey || !orderId) throw new HttpError(400, '결제 정보가 올바르지 않아요.')

  const { data: order } = await db.from('orders').select('*').eq('order_no', orderId).single()
  // 회원 주문은 본인만, 비회원 주문은 토스가 발급한 paymentKey로 확인한다
  if (!order || (order.user_id && order.user_id !== user?.id)) throw new HttpError(404, '주문을 찾을 수 없어요.')
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

  if (payment.status === 'WAITING_FOR_DEPOSIT') {
    // 가상계좌: 아직 돈이 들어온 게 아니다. 입금되면 웹훅(/api/payments/webhook)이 결제 완료로 바꾼다
    const va = payment.virtualAccount || {}
    const { error } = await db.from('orders').update({
      status: 'awaiting_deposit',
      payment_key: payment.paymentKey,
      payment_method: '가상계좌',
      receipt_url: payment.receipt?.url ?? null,
      deposit_info: {
        bank: bankName(va.bankCode),
        accountNumber: va.accountNumber,
        holder: va.customerName,
        dueDate: va.dueDate,
      },
    }).eq('id', order.id).eq('status', 'pending')
    if (error) throw error
    await notifyOrder(order.id, 'awaiting')
  } else if (payment.status === 'DONE') {
    const { error } = await db.rpc('mark_order_paid', {
      p_order_id: order.id,
      p_payment_key: payment.paymentKey,
      p_method: payment.method + (payment.card?.company ? ` (${payment.card.company})` : payment.easyPay?.provider ? ` (${payment.easyPay.provider})` : ''),
      p_receipt_url: payment.receipt?.url ?? null,
    })
    if (error) throw error
    await notifyOrder(order.id, 'paid')
  } else {
    throw new HttpError(400, `결제가 완료되지 않았어요. (${payment.status})`)
  }

  const { data: updated } = await db.from('orders').select('*').eq('id', order.id).single()
  return { order: updated }
})
