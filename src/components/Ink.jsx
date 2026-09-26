// 수묵화 컨셉 공용 그림 요소 (광고 영상의 톤: 한지 · 먹 번짐 · 대나무 · 붉은 낙관)

export function Seal({ size = 44, className = '' }) {
  return (
    <span className={`seal ${className}`} style={{ '--seal-size': `${size}px` }} aria-hidden="true">
      <span>천왕</span>
      <span>봉</span>
    </span>
  )
}

// 먹 번짐 원
export function InkBlot({ className = '' }) {
  return (
    <svg className={`ink-blot ${className}`} viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id="blot-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="22" />
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <radialGradient id="blot-fill">
          <stop offset="0" stopColor="#1c1a17" stopOpacity=".85" />
          <stop offset=".6" stopColor="#3a3733" stopOpacity=".55" />
          <stop offset="1" stopColor="#6b675f" stopOpacity=".05" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="78" fill="url(#blot-fill)" filter="url(#blot-rough)" />
    </svg>
  )
}

// 천왕봉 능선 + 붉은 해
export function InkMountains({ className = '' }) {
  return (
    <svg className={`ink-mountains ${className}`} viewBox="0 0 1440 560" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b3a8" /><stop offset="1" stopColor="#e7e0d2" />
        </linearGradient>
        <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a39d92" /><stop offset="1" stopColor="#ddd6c7" />
        </linearGradient>
        <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e887d" /><stop offset=".7" stopColor="#d9d2c3" />
        </linearGradient>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe8d8" stopOpacity="0" /><stop offset="1" stopColor="#efe8d8" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <circle cx="1080" cy="120" r="44" fill="#b83a32" opacity=".92" />
      <path d="M0 330 C120 300 220 320 330 300 C430 285 520 310 600 280 C660 250 700 150 790 90 C830 64 860 70 890 100 C960 170 1010 230 1100 260 C1200 290 1300 250 1440 270 L1440 560 L0 560 Z" fill="url(#m1)" />
      <g className="peak-label">
        <line x1="840" y1="46" x2="840" y2="78" stroke="#6b675f" strokeWidth="1" />
        <text x="840" y="36" textAnchor="middle">천왕봉 1,915m</text>
      </g>
      <path d="M0 400 C140 380 240 400 360 370 C470 345 560 380 660 350 C760 320 830 300 930 330 C1050 365 1150 330 1260 345 C1340 355 1400 345 1440 350 L1440 560 L0 560 Z" fill="url(#m2)" opacity=".9" />
      <rect x="0" y="380" width="1440" height="120" fill="url(#mist)" />
      <path d="M0 470 C160 440 280 480 420 455 C560 430 660 470 800 450 C960 428 1080 470 1220 450 C1320 436 1390 452 1440 448 L1440 560 L0 560 Z" fill="url(#m3)" opacity=".85" />
      <rect x="0" y="500" width="1440" height="60" fill="url(#mist)" />
    </svg>
  )
}

// 대나무 (먹선)
export function Bamboo({ className = '', flip = false }) {
  const stalk = (x, top, w, shade) => (
    <g key={x}>
      <rect x={x} y={top} width={w} height={600 - top} fill={shade} rx={w / 3} />
      {Array.from({ length: Math.floor((600 - top) / 70) }, (_, i) => (
        <rect key={i} x={x - 1.5} y={top + 60 + i * 70} width={w + 3} height="3" fill="#f0e9da" opacity=".7" />
      ))}
    </g>
  )
  const leaf = (x, y, r, s = 1) => (
    <path key={`${x}-${y}-${r}`} d="M0 0 C18 -6 44 -4 70 0 C44 4 18 6 0 0 Z" fill="#26241f"
      transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity=".88" />
  )
  return (
    <svg className={`bamboo ${className}`} viewBox="0 0 260 600" aria-hidden="true"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {stalk(40, 160, 7, '#7d786e')}
      {stalk(210, 120, 6, '#8c877c')}
      {stalk(150, 60, 9, '#4a4640')}
      {stalk(100, 0, 12, '#26241f')}
      {[
        [112, 40, -30], [112, 44, -150, .9], [112, 120, 20, .8], [112, 124, 160, 1.1],
        [158, 90, -20, .8], [158, 150, -160, .9], [106, 210, -40, .7], [160, 250, 30, .7],
        [214, 150, -140, .6], [46, 190, -60, .6],
      ].map(([x, y, r, s]) => leaf(x, y, r, s))}
    </svg>
  )
}

// 과정 아이콘
export function ProcessIcon({ type }) {
  switch (type) {
    case 'salt':
      return (
        <svg viewBox="0 0 80 60" aria-hidden="true">
          {[[14, 38], [24, 32], [34, 38], [44, 30], [54, 36], [64, 32], [20, 44], [30, 46], [40, 42], [50, 46], [60, 42], [36, 26], [48, 22]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="8" height="8" rx="1.5" fill="#fbf8f1" stroke="#9a948a" strokeWidth="1"
              transform={`rotate(${(i * 23) % 45} ${x + 4} ${y + 4})`} />
          ))}
        </svg>
      )
    case 'bamboo':
      return (
        <svg viewBox="0 0 80 60" aria-hidden="true">
          <rect x="30" y="2" width="20" height="56" rx="3" fill="#2d2b27" />
          {[12, 24, 36, 48].map((y) => <rect key={y} x="27" y={y} width="26" height="3" rx="1" fill="#5b574f" />)}
        </svg>
      )
    case 'clay':
      return (
        <svg viewBox="0 0 80 60" aria-hidden="true">
          <circle cx="40" cy="30" r="22" fill="#b98a55" />
          <circle cx="34" cy="24" r="6" fill="#c99b66" />
          <circle cx="48" cy="36" r="4" fill="#a67844" />
        </svg>
      )
    case 'fire':
      return (
        <svg viewBox="0 0 80 60" aria-hidden="true">
          <path d="M40 2 C52 18 58 28 54 42 C51 52 29 52 26 42 C22 30 34 22 40 2 Z" fill="#d9652b" />
          <path d="M40 18 C47 28 49 36 46 44 C43 50 37 50 34 44 C31 36 36 30 40 18 Z" fill="#f2b33d" />
          <rect x="16" y="50" width="48" height="5" rx="2" fill="#3a2a1d" transform="rotate(-10 40 52)" />
          <rect x="16" y="50" width="48" height="5" rx="2" fill="#3a2a1d" transform="rotate(10 40 52)" />
        </svg>
      )
    default:
      return null
  }
}
