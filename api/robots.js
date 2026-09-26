import { origin } from './_seo.js'

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.end(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /checkout
Disallow: /mypage
Disallow: /payment/
Disallow: /order/
Disallow: /api/

Sitemap: ${origin(req)}/sitemap.xml
`)
}
