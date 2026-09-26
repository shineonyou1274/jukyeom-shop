import { usePageMeta } from '../lib/usePageMeta'
import { STORE } from '../config/store'
import { InkMountains, Seal } from '../components/Ink'

const q = encodeURIComponent('천왕봉죽염')
const addr = encodeURIComponent(STORE.address.replace(/\s*\(.*\)$/, ''))

export default function Location() {
  usePageMeta('오시는 길', `${STORE.name} 오시는 길 — ${STORE.address}`)
  return (
    <div className="container page narrow">
      <h1>오시는 길</h1>
      <div className="location-card">
        <InkMountains className="location-art" />
        <div className="location-body">
          <Seal size={44} />
          <div>
            <h2>{STORE.name}</h2>
            <p>{STORE.address}</p>
            <p className="muted small">지리산 천왕봉 아래, 경남 산청군 시천면</p>
          </div>
        </div>
      </div>

      <div className="map-buttons">
        <a className="btn btn-primary" href={`https://map.naver.com/p/search/${q}`} target="_blank" rel="noreferrer">네이버 지도로 보기</a>
        <a className="btn btn-ghost" href={`https://map.kakao.com/link/search/${q}`} target="_blank" rel="noreferrer">카카오맵으로 보기</a>
        <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${addr}`} target="_blank" rel="noreferrer">구글 지도로 보기</a>
      </div>

      <dl className="spec location-info">
        <dt>주소</dt><dd>{STORE.address}</dd>
        <dt>전화</dt>
        <dd>
          <a href={`tel:${STORE.phone.replace(/-/g, '')}`}>{STORE.phone}</a>
          {STORE.mobile && <> · <a href={`tel:${STORE.mobile.replace(/-/g, '')}`}>{STORE.mobile}</a></>}
        </dd>
        <dt>운영</dt><dd>{STORE.csHours}</dd>
        <dt>찾아오실 때</dt><dd>내비게이션에 주소 또는 &lsquo;천왕봉죽염&rsquo;을 검색해 주세요. 방문 전에 전화 주시면 더 정확히 안내해 드려요.</dd>
      </dl>
    </div>
  )
}
