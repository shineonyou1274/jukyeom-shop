// 광고 영상 (public/videos). 누르면 재생되고, 화면에 보일 때까지는 내려받지 않는다
const VIDEOS = [
  { src: '/videos/ad1.mp4', poster: '/videos/ad1.jpg', title: '아홉 번 굽고 또 굽다', text: '대나무에 담고 황토로 막아 소나무 불에 굽는 과정' },
  { src: '/videos/ad2.mp4', poster: '/videos/ad2.jpg', title: '매일, 한 꼬집', text: '오늘의 식탁에 지리산 천왕봉 죽염 한 꼬집' },
  { src: '/videos/ad3.mp4', poster: '/videos/ad3.jpg', title: '죽염과 함께하는 하루', text: '아침부터 요리할 때까지, 천왕봉 죽염 쓰는 법' },
]

export default function AdVideos() {
  return (
    <section className="container section videos">
      <div className="section-head">
        <h2>영상으로 보는 천왕봉 죽염</h2>
      </div>
      <div className="video-grid">
        {VIDEOS.map((v) => (
          <figure key={v.src} className="video-card">
            <video src={v.src} poster={v.poster} controls playsInline preload="none" />
            <figcaption>
              <b>{v.title}</b>
              <span>{v.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
