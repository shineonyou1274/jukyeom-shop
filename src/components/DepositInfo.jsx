import { BANK } from '../config/store'
import { depositDue, won } from '../lib/format'

// 입금 대기 주문의 입금 안내 (무통장입금 / 가상계좌 공용)
export default function DepositInfo({ order }) {
  const bank = order.payment_type === 'bank'
    ? { bank: BANK.bank, accountNumber: BANK.account, holder: BANK.holder }
    : order.deposit_info || {}
  return (
    <div className="deposit-box">
      <dl>
        <dt>입금 계좌</dt>
        <dd><b>{bank.bank} {bank.accountNumber}</b>{bank.holder && <> (예금주 {bank.holder})</>}</dd>
        <dt>입금 금액</dt>
        <dd><b>{won(order.total_amount)}</b></dd>
        {order.depositor_name && (<><dt>입금자명</dt><dd>{order.depositor_name}</dd></>)}
        <dt>입금 기한</dt>
        <dd>{depositDue(order, BANK.dueDays)}까지</dd>
      </dl>
      <p className="small muted">
        {order.payment_type === 'bank'
          ? '입금자명과 금액이 정확해야 확인이 빨라요. 입금이 확인되면 바로 발송 준비를 시작해요.'
          : '이 계좌는 이번 주문 전용이에요. 입금되면 자동으로 결제 완료 처리돼요.'}
        {' '}기한 안에 입금되지 않으면 주문이 취소될 수 있어요.
      </p>
    </div>
  )
}
