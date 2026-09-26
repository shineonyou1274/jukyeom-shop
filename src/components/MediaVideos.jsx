import { useState } from 'react'

// 천왕봉 죽염이 나온 방송·유튜브 영상. 처음에는 미리보기 사진만 보여주고, 누르면 그때 영상을 불러온다
const MEDIA = [
  { type: 'youtube', id: 'XcKvRxVqkvo', title: '천왕봉 죽염이 나온 영상' },
  { type: 'youtube', id: 'SumIDZuwGRc', title: '천왕봉 죽염이 나온 영상' },
  { type: 'youtube', id: 'SdaRKKrprcU', title: '천왕봉 죽염 쇼츠', vertical: true },
  { type: 'drive', id: '1Q0Zt_0PO4GbNuPsPiRWMSS-kBDiao2es', title: '천왕봉 죽염 영상', vertical: true },
]

const thumb = (m) => m.type === 'youtube'
  ? `https://i.ytimg.com/vi/${m.id}/hqdefault.jpg`
  : `https://drive.google.com/thumbnail?id=${m.id}&sz=w640`
const player = (m) => m.type === 'youtube'
  ? `https://www.youtube-nocookie.com/embed/${m.id}?autoplay=1&rel=0&playsinline=1`
  : `https://drive.google.com/file/d/${m.id}/preview`

function MediaCard({ m }) {
  const [on, setOn] = useState(false)
  return (
    <figure className={`media-card${m.vertical ? ' tall' : ''}`}>
      <div className="media-frame">
        {on ? (
          <iframe src={player(m)} title={m.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : (
          <button type="button" className="media-poster" onClick={() => setOn(true)} aria-label={`${m.title} 재생`}>
            <img src={thumb(m)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = "hidden" }} />
            <span className="media-play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <figcaption>{m.title}</figcaption>
    </figure>
  )
}

export default function MediaVideos() {
  const wide = MEDIA.filter((m) => !m.vertical)
  const tall = MEDIA.filter((m) => m.vertical)
  return (
    <section className="container section media">
      <div className="section-head">
        <h2>방송·영상 속 천왕봉 죽염</h2>
      </div>
      <div className="media-grid">{wide.map((m) => <MediaCard key={m.id} m={m} />)}</div>
      {tall.length > 0 && <div className="media-grid tall">{tall.map((m) => <MediaCard key={m.id} m={m} />)}</div>}
    </section>
  )
}
