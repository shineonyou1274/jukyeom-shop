import webpush from 'web-push'
import { supabaseAdmin } from './_lib.js'

const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`

// 관리자 휴대폰으로 웹 푸시 알림을 보낸다. 알림이 실패해도 주문·결제는 그대로 진행돼야 하므로 에러를 밖으로 던지지 않는다
export async function notifyAdmins(message, only) {
  try {
    const db = supabaseAdmin()
    let query = db.from('push_subscriptions').select('*')
    if (only) query = query.eq('endpoint', only)
    const [{ data: subs }, { data: keys }] = await Promise.all([
      query,
      db.from('app_secrets').select('key, value').in('key', ['vapid_public', 'vapid_private']),
    ])
    if (!subs?.length) return 0
    const k = Object.fromEntries((keys || []).map((r) => [r.key, r.value]))
    webpush.setVapidDetails('mailto:1274salt@gmail.com', k.vapid_public, k.vapid_private)
    const payload = JSON.stringify(message)
    const results = await Promise.all(subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' })
        .then(() => true)
        .catch(async (err) => {
          // 앱을 지웠거나 알림을 끈 기기는 목록에서 뺀다
          if (err.statusCode === 404 || err.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
          else console.error('push failed', err.statusCode, err.body)
          return false
        })))
    return results.filter(Boolean).length
  } catch (err) {
    console.error('notify failed', err)
    return 0
  }
}

const TITLES = {
  paid: '🧂 새 주문 · 결제 완료',
  awaiting: '🧂 새 주문 · 입금 대기',
  deposited: '💰 입금 확인 · 발송 준비',
}

export async function notifyOrder(orderId, kind) {
  try {
    const { data: o } = await supabaseAdmin().from('orders')
      .select('order_no, order_name, total_amount, receiver_name, orderer_name, payment_method')
      .eq('id', orderId).single()
    if (!o) return
    await notifyAdmins({
      title: TITLES[kind],
      body: `${o.order_name}\n${won(o.total_amount)} · ${o.orderer_name || o.receiver_name} (${o.payment_method || '결제'})`,
      url: '/admin',
      tag: o.order_no,
    })
  } catch (err) {
    console.error('notify order failed', err)
  }
}
