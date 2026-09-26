import { useEffect, useRef, useState } from 'react'

// 가게 위치 지도: 네이버 지도 키(VITE_NAVER_MAP_KEY)가 있으면 네이버 지도, 없거나 실패하면 구글 지도
// 네이버 클라우드 Maps Client ID (공개돼도 되는 값, 허용 도메인은 네이버 클라우드 콘솔에서 관리)
const NAVER_KEY = import.meta.env.VITE_NAVER_MAP_KEY || 'akw26j568d'

let naverLoading
function loadNaver() {
  if (window.naver?.maps?.Service) return Promise.resolve()
  naverLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_KEY}&submodules=geocoder`
    s.onload = () => (window.naver?.maps ? resolve() : reject(new Error('naver maps')))
    s.onerror = () => { naverLoading = null; reject(new Error('naver maps')) }
    document.head.appendChild(s)
  })
  return naverLoading
}

export default function StoreMap({ address, name }) {
  const ref = useRef(null)
  const [fallback, setFallback] = useState(!NAVER_KEY)

  useEffect(() => {
    if (!NAVER_KEY) return
    let cancelled = false
    loadNaver()
      .then(() => new Promise((resolve, reject) => {
        window.naver.maps.Service.geocode({ query: address }, (status, res) => {
          const a = res?.v2?.addresses?.[0]
          if (status !== window.naver.maps.Service.Status.OK || !a) return reject(new Error('geocode'))
          resolve(new window.naver.maps.LatLng(Number(a.y), Number(a.x)))
        })
      }))
      .then((pos) => {
        if (cancelled || !ref.current) return
        const map = new window.naver.maps.Map(ref.current, { center: pos, zoom: 15, zoomControl: true })
        const marker = new window.naver.maps.Marker({ position: pos, map })
        new window.naver.maps.InfoWindow({ content: `<div style="padding:8px 12px;font-weight:700">${name}</div>` }).open(map, marker)
      })
      .catch(() => !cancelled && setFallback(true))
    return () => { cancelled = true }
  }, [address, name])

  if (fallback) {
    return (
      <iframe
        className="store-map"
        title={`${name} 위치 지도`}
        src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&hl=ko&output=embed`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    )
  }
  return <div ref={ref} className="store-map" role="img" aria-label={`${name} 위치 지도`} />
}
