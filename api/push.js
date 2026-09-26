import { HttpError, postHandler, requireAdmin, supabaseAdmin } from './_lib.js'
import { notifyAdmins } from './_notify.js'

// 관리자 휴대폰 주문 알림 켜기·끄기·시험 보내기
export default postHandler(async (req, body) => {
  const user = await requireAdmin(req)
  const db = supabaseAdmin()
  const sub = body.subscription || {}
  const endpoint = String(sub.endpoint || body.endpoint || '')
  if (!endpoint.startsWith('https://')) throw new HttpError(400, '알림 정보가 올바르지 않아요.')

  if (body.action === 'subscribe') {
    if (!sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, '알림 정보가 올바르지 않아요.')
    const { error } = await db.from('push_subscriptions')
      .upsert({ user_id: user.id, endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: 'endpoint' })
    if (error) throw error
    const sent = await notifyAdmins({ title: '천왕봉 죽염', body: '주문 알림이 켜졌어요. 새 주문이 들어오면 이렇게 알려드릴게요.', url: '/admin' }, endpoint)
    return { ok: true, sent }
  }
  if (body.action === 'unsubscribe') {
    await db.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return { ok: true }
  }
  if (body.action === 'test') {
    const sent = await notifyAdmins({ title: '🧂 알림 시험', body: '주문 알림이 잘 오고 있어요.', url: '/admin' }, endpoint)
    if (!sent) throw new HttpError(400, '알림을 보내지 못했어요. 알림을 껐다가 다시 켜 주세요.')
    return { ok: true }
  }
  throw new HttpError(400, '알 수 없는 요청이에요.')
})
