import { activeProducts, origin } from './_seo.js'

export default async function handler(req, res) {
  const base = origin(req)
  const products = await activeProducts().catch(() => [])
  const urls = ['/', '/products', ...products.map((p) => `/products/${p.id}`), '/location', '/refund', '/terms', '/privacy']
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600')
  res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}
</urlset>`)
}
