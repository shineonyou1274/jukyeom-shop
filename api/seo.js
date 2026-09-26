import { STORE, activeProducts, esc, origin, won } from './_seo.js'

// 검색엔진·카카오톡 등 봇이 들어오면 (vercel.json의 user-agent 조건) 내용이 채워진 HTML을 돌려준다.
// 사람은 원래대로 React 화면(index.html)을 받는다.
const DEFAULT_DESC = '지리산 천왕봉 아래 산청에서, 대나무 통에 천일염을 담아 황토로 막고 소나무 장작불에 아홉 번 굽고 또 구운 천왕봉 죽염. 9회 죽염(고체·분말), 3회 생활죽염, 죽염간장·된장, 선물세트.'

function page({ base, path, title, desc, image, body, jsonld }) {
  const url = base + path
  return `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="naver-site-verification" content="eba236c3cdd027ea9bd34c92efc61cf3a2ea4c77" />
<link rel="canonical" href="${esc(url)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${esc(STORE.name)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
</head><body>
${body}
<footer><p>${esc(STORE.name)} · 대표 ${esc(STORE.owner)} · 사업자등록번호 ${esc(STORE.bizNo)} · 통신판매업신고 ${esc(STORE.mailOrderNo)}</p>
<p>${esc(STORE.address)} · ${esc(STORE.phone)}${STORE.mobile ? ` / ${esc(STORE.mobile)}` : ''}</p></footer>
</body></html>`
}

const storeLd = (base) => ({
  '@context': 'https://schema.org',
  '@type': 'Store',
  name: STORE.name,
  url: base,
  image: `${base}/images/og.jpg`,
  telephone: STORE.phone,
  address: { '@type': 'PostalAddress', streetAddress: STORE.address, addressLocality: '산청군', addressRegion: '경상남도', addressCountry: 'KR' },
})

function productBlock(p, base) {
  const prices = p.options.length
    ? `<ul>${p.options.map((o) => `<li>${esc(o.label)} ${won(o.price)}</li>`).join('')}</ul>`
    : `<p>${won(p.price)}</p>`
  return `<article><h2><a href="${base}/products/${p.id}">${esc(p.name)}</a></h2><p>${esc(p.subtitle)}</p>${prices}</article>`
}

export default async function handler(req, res) {
  const base = origin(req)
  const path = String(req.query?.path || new URL(req.url, base).searchParams.get('path') || '/')
  let html
  try {
    const products = await activeProducts()
    const m = path.match(/^\/products\/(\d+)/)
    const p = m && products.find((x) => x.id === Number(m[1]))
    if (p) {
      const prices = p.options.length ? p.options.map((o) => o.price) : [p.price]
      const desc = `${p.name} ${p.subtitle || ''} — ${(p.description || '').replace(/\s+/g, ' ').slice(0, 110)}`
      html = page({
        base, path: `/products/${p.id}`,
        title: `${p.name} | ${STORE.name}`,
        desc,
        image: p.image_url || `${base}/images/og.jpg`,
        jsonld: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          description: p.description,
          image: p.image_url || `${base}/images/og.jpg`,
          brand: { '@type': 'Brand', name: STORE.name },
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'KRW',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: prices.length,
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: STORE.name },
          },
        },
        body: `<header><a href="${base}/">${esc(STORE.name)}</a></header><main>${productBlock(p, base)}
<section><h3>상품 설명</h3><p>${esc(p.description).replace(/\n/g, '<br>')}</p></section>
${p.info_notice ? `<section><h3>상품정보 제공고시</h3><p>${esc(p.info_notice).replace(/\n/g, '<br>')}</p></section>` : ''}</main>`,
      })
    } else {
      const isList = path.startsWith('/products')
      html = page({
        base, path: isList ? '/products' : '/',
        title: isList ? `전체상품 | ${STORE.name}` : `${STORE.name} | 지리산 산청에서 아홉 번 구운 죽염`,
        desc: DEFAULT_DESC,
        image: `${base}/images/og.jpg`,
        jsonld: storeLd(base),
        body: `<header><h1>${esc(STORE.name)}</h1><p>${esc(DEFAULT_DESC)}</p></header>
<main><h2>상품</h2>${products.map((x) => productBlock(x, base)).join('')}
<section><h2>만드는 과정</h2><p>비금도 천일염을 3년 동안 간수를 빼고, 지리산에서 4년 넘게 자란 왕대나무 통에 다져 담아 진흙으로 입구를 막고, 1,300℃ 넘는 불길에 아홉 번 굽고 또 굽습니다.</p></section></main>`,
      })
    }
  } catch (err) {
    console.error(err)
    html = page({ base, path: '/', title: STORE.name, desc: DEFAULT_DESC, image: `${base}/images/og.jpg`, jsonld: storeLd(base), body: `<h1>${esc(STORE.name)}</h1>` })
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=86400')
  res.end(html)
}
