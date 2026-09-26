import { useEffect, useState } from 'react'
import { callApi } from '../lib/api'
import { PUSH_PUBLIC_KEY } from '../config/store'

const toKey = (b64) => {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}
const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// 관리자 화면 맨 위: 이 휴대폰으로 주문 알림 받기
export default function OrderAlerts() {
  const [sub, setSub] = useState()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!supported) return setSub(null)
    navigator.serviceWorker.getRegistration().then((reg) => reg?.pushManager.getSubscription()).then((s) => setSub(s || null))
  }, [])

  const run = async (fn) => {
    setBusy(true); setMsg('')
    try { await fn() } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  const turnOn = () => run(async () => {
    if ((await Notification.requestPermission()) !== 'granted') {
      throw new Error('알림이 차단돼 있어요. 주소창 옆 자물쇠(또는 휴대폰 설정 → 앱 → 알림)에서 알림을 허용해 주세요.')
    }
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'))
    await navigator.serviceWorker.ready
    const s = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(PUSH_PUBLIC_KEY) }))
    await callApi('push', { action: 'subscribe', subscription: s.toJSON() })
    setSub(s)
    setMsg('켜졌어요. 방금 시험 알림을 보냈어요.')
  })

  const turnOff = () => run(async () => {
    await callApi('push', { action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
    setSub(null)
    setMsg('이 휴대폰의 주문 알림을 껐어요.')
  })

  const test = () => run(async () => {
    await callApi('push', { action: 'test', endpoint: sub.endpoint })
    setMsg('시험 알림을 보냈어요.')
  })

  if (sub === undefined) return null
  return (
    <div className="order-alerts">
      <div>
        <b>🔔 주문 알림 {sub ? <span className="on">켜짐</span> : <span>꺼짐</span>}</b>
        <p className="small muted">
          {!supported
            ? '이 브라우저는 알림을 지원하지 않아요. 휴대폰 크롬이나 홈 화면에 설치한 앱에서 열어 주세요.'
            : sub
              ? '새 주문, 입금 확인이 이 기기로 알림이 와요.'
              : '켜 두면 새 주문이 들어올 때 이 기기로 알림이 와요.'}
        </p>
        {msg && <p className="small notice">{msg}</p>}
      </div>
      {supported && (
        <div className="admin-actions">
          {sub ? (
            <>
              <button className="btn btn-ghost" disabled={busy} onClick={test}>시험 알림</button>
              <button className="btn btn-ghost" disabled={busy} onClick={turnOff}>끄기</button>
            </>
          ) : (
            <button className="btn btn-primary" disabled={busy} onClick={turnOn}>이 기기로 알림 받기</button>
          )}
        </div>
      )}
    </div>
  )
}
