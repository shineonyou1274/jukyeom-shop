import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from '../config/store'

export const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`

export const dateTime = (s) =>
  s ? new Date(s).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : ''

export const shippingFeeFor = (itemsAmount) =>
  itemsAmount === 0 || itemsAmount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE

export const ORDER_STATUS = {
  pending: '결제 대기',
  awaiting_deposit: '입금 대기',
  paid: '결제 완료',
  preparing: '상품 준비중',
  shipped: '배송중',
  delivered: '배송 완료',
  cancelled: '주문 취소',
  failed: '결제 실패',
}

export const phoneFormat = (v) => {
  const d = String(v).replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`
}

// 입금 기한: 가상계좌는 토스가 정한 기한, 무통장입금은 주문일 + dueDays
export function depositDue(order, dueDays) {
  const d = order.deposit_info?.dueDate ? new Date(order.deposit_info.dueDate) : new Date(new Date(order.created_at).getTime() + dueDays * 86400000)
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
