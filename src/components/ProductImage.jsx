// 사진이 없으면 광고 속 패키지(유리병 + 한지 라벨 + 먹 대나무)를 닮은 그림을 대신 보여준다
export default function ProductImage({ product, className = '' }) {
  if (product?.image_url) {
    return <img className={`product-img ${className}`} src={product.image_url} alt={product.name} loading="lazy" />
  }
  const name = product?.name || ''
  const nine = /9회/.test(name)
  // 라벨 글자: 간장·된장은 그 이름으로, 나머지는 죽염
  const [c1, c2] = /간장/.test(name) && !/된장/.test(name) ? ['간', '장'] : /된장/.test(name) ? ['된', '장'] : ['죽', '염']
  const sub = /간장|된장/.test(name) ? '숙성' : nine ? '9회' : '3회'
  return (
    <div className={`product-img placeholder ${className}`} role="img" aria-label={product?.name}>
      <svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id="cap" x1="0" x2="1">
            <stop offset="0" stopColor="#9d9d9b" /><stop offset=".45" stopColor="#e9e9e6" /><stop offset="1" stopColor="#8e8e8b" />
          </linearGradient>
          <linearGradient id="glass" x1="0" x2="1">
            <stop offset="0" stopColor="#d9d4c8" /><stop offset=".3" stopColor="#f4f1ea" /><stop offset="1" stopColor="#cfc9bc" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="182" rx="50" ry="6" fill="rgba(0,0,0,.08)" />
        <rect x="64" y="22" width="72" height="24" rx="6" fill="url(#cap)" />
        <rect x="58" y="44" width="84" height="136" rx="16" fill="url(#glass)" stroke="#bdb6a8" strokeWidth="1.2" />
        <rect x="62" y="64" width="76" height="98" rx="4" fill="#ebe3d2" />
        <g stroke="#3a3733" strokeLinecap="round" opacity=".55">
          <line x1="122" y1="160" x2="126" y2="70" strokeWidth="3" />
          <line x1="131" y1="160" x2="133" y2="92" strokeWidth="2" />
        </g>
        <g fill="#3a3733" opacity=".55">
          <path d="M126 80 c8 -4 14 -3 18 -1 c-6 3 -12 3 -18 1z" />
          <path d="M126 96 c-8 -3 -14 -1 -18 2 c6 2 12 1 18 -2z" />
        </g>
        <text x="86" y="104" textAnchor="middle" fontSize="30" fill="#1f1d1a" fontFamily="'Nanum Brush Script', cursive">{c1}</text>
        <text x="86" y="136" textAnchor="middle" fontSize="30" fill="#1f1d1a" fontFamily="'Nanum Brush Script', cursive">{c2}</text>
        <rect x="104" y="72" width="11" height="11" rx="1" fill="#b83a32" />
        <text x="86" y="154" textAnchor="middle" fontSize="8" fill="#6b675f" fontFamily="'Noto Serif KR', serif">{sub}</text>
      </svg>
    </div>
  )
}
