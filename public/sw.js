// 앱 설치용 최소 서비스워커: 화면 파일만 캐시하고, 주문·결제·상품 데이터는 항상 서버에서 새로 받는다
const CACHE = 'jukyeom-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  // 화면(HTML)은 네트워크 우선, 오프라인이면 저장해 둔 화면
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => { caches.open(CACHE).then((c) => c.put('/', res.clone())); return res })
        .catch(() => caches.match('/')),
    )
    return
  }
  // 빌드 파일·이미지는 캐시 우선
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/') || /\.(png|svg|jpg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()))
        return res
      })),
    )
  }
})

// 관리자 주문 알림 (서버 /api/_notify.js 에서 보냄)
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { data = { body: e.data?.text() } }
  e.waitUntil(self.registration.showNotification(data.title || '천왕봉 죽염', {
    body: data.body || '새 소식이 있어요.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    renotify: Boolean(data.tag),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/admin' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = new URL(e.notification.data?.url || '/admin', self.location.origin).href
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins.find((w) => w.url.startsWith(self.location.origin))
    if (win) return win.navigate(url).then((w) => (w || win).focus())
    return self.clients.openWindow(url)
  }))
})
