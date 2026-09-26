import { usePageMeta } from '../lib/usePageMeta'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { Bamboo, InkBlot, InkMountains, ProcessIcon, Seal } from '../components/Ink'
import AdVideos from '../components/AdVideos'
import { useProducts } from '../lib/useProducts'
import { won } from '../lib/format'
import { FREE_SHIPPING_THRESHOLD } from '../config/store'

const STEPS = [
  ['salt', '천일염', '비금도 천일염을 3년 동안 간수 빼고'],
  ['bamboo', '대나무', '4년 넘게 자란 지리산 왕대나무 통에 다져 담아'],
  ['clay', '황토', '진흙으로 입구를 단단히 막고'],
  ['fire', '소나무 장작불', '1,300℃ 넘는 불길에 굽는다'],
]

export default function Home() {
  usePageMeta()
  const { products } = useProducts()

  return (
    <>
      <section className="hero">
        <InkMountains />
        <Bamboo className="hero-bamboo" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="vertical hero-vertical">지리산 천왕봉 아래 · 산청에서</p>
            <div>
              <h1 className="sr-only">천왕봉 죽염</h1>
              <img src="/images/logo-brush.png" alt="죽염 · 천왕봉" className="hero-logo" width="449" height="302" />
              <p className="hero-sub">대나무 통에 천일염을 담아 황토로 막고,<br />소나무 장작불에 아홉 번 굽고 또 굽다</p>
              <div className="hero-actions">
                <Link to="/products" className="btn btn-primary">상품 보러가기</Link>
                <a href="#process" className="btn btn-ghost">만드는 과정</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>천왕봉 죽염</h2>
          <Link to="/products" className="more">전체보기 →</Link>
        </div>
        {!products ? (
          <p className="muted">불러오는 중…</p>
        ) : (
          <div className="grid">
            {products.slice(0, 4).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <section id="process" className="process">
        <div className="container">
          <p className="eyebrow">만드는 과정</p>
          <h2 className="process-title">대나무 통에 천일염을 담아 황토로 막고, 소나무 장작불에 굽는다</h2>
          <ol className="steps">
            {STEPS.map(([icon, title, text], i) => (
              <li key={icon}>
                <div className="step-icon"><ProcessIcon type={icon} /></div>
                <b>{title}</b>
                <span className="step-no">0{i + 1}</span>
                <p>{text}</p>
              </li>
            ))}
          </ol>

          <div className="nine">
            <h2 className="brush-title"><img src="/images/brush-nine.png" alt="아홉 번 굽고 또 굽다" width="879" height="173" /></h2>
            <ol className="nine-fires" aria-label="아홉 번의 굽기">
              {Array.from({ length: 9 }, (_, i) => <li key={i} className={i === 8 ? 'last' : ''}>{i + 1}</li>)}
            </ol>
            <p className="muted">굽고, 식혀 부수고, 다시 대나무에 담아 굽기를 아홉 번.<br />시간과 정성이 쌓인 만큼 짠맛은 둥글고 깊어집니다.</p>
          </div>
        </div>
      </section>

      <AdVideos />

      <section className="container section showcase">
        <div className="showcase-media">
          <InkBlot className="showcase-blot" />
          <img src="/images/product-set.jpg" alt="천왕봉 죽염 유리병과 선물 상자" loading="lazy" />
        </div>
        <div className="showcase-text">
          <p className="vertical showcase-vertical">천왕봉 죽염</p>
          <div>
            <p className="eyebrow">9회 죽염 · 3회 죽염</p>
            <h2>한지 빛 상자에 담아<br />마음까지 전합니다</h2>
            <p className="muted">매일 쓰는 3회 생활죽염부터 아홉 번 구운 9회 죽염, 5년 넘게 숙성한 죽염 된장·간장과 선물세트까지.</p>
            <Link to="/products" className="btn btn-primary">전체 상품 보기</Link>
          </div>
          <Seal size={52} className="showcase-seal" />
        </div>
      </section>

      <section className="container section info-strip">
        <div><b>무료배송</b><span>{won(FREE_SHIPPING_THRESHOLD)} 이상 구매 시</span></div>
        <div><b>안전결제</b><span>토스페이먼츠 카드결제</span></div>
        <div><b>선물포장</b><span>선물세트 보자기 포장</span></div>
      </section>
    </>
  )
}
