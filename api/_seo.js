import { supabaseAdmin } from './_lib.js'
import { STORE } from '../src/config/store.js'

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export const origin = (req) => `https://${req.headers['x-forwarded-host'] || req.headers.host}`
export const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`

export async function activeProducts() {
  const { data } = await supabaseAdmin()
    .from('products').select('*, product_options(*)').eq('is_active', true).order('sort_order').order('id')
  return (data || []).map((p) => ({
    ...p,
    options: (p.product_options || []).filter((o) => o.is_active).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export { STORE }
