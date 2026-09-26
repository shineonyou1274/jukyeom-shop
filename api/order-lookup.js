import { HttpError, digits, postHandler, supabaseAdmin } from './_lib.js'

// 비회원 주문 조회: 주문번호 + 주문자 휴대폰 번호가 모두 맞아야 보여준다
export default postHandler(async (_req, body) => {
  const orderNo = String(body.orderNo ?? '').trim().toUpperCase()
  const phone = digits(body.phone)
  if (!orderNo || phone.length < 10) throw new HttpError(400, '주문번호와 휴대폰 번호를 입력해 주세요.')

  const { data: order } = await supabaseAdmin()
    .from('orders').select('*, order_items(*)')
    .eq('order_no', orderNo).is('user_id', null).eq('orderer_phone', phone)
    .not('status', 'in', '(pending,failed)')
    .maybeSingle()
  if (!order) throw new HttpError(404, '일치하는 주문이 없어요. 주문번호와 휴대폰 번호를 확인해 주세요.')
  return { order }
})
