import { sendJson, supabaseAdmin } from './_lib.js'

// Supabase 무료 플랜은 일주일 동안 요청이 없으면 프로젝트를 멈춘다.
// Vercel Cron(vercel.json의 crons)이 매일 한 번 불러서 DB를 가볍게 읽어 깨워 둔다.
export default async function handler(req, res) {
  try {
    const { count, error } = await supabaseAdmin().from('products').select('id', { count: 'exact', head: true })
    if (error) throw error
    sendJson(res, 200, { ok: true, products: count, at: new Date().toISOString() })
  } catch (err) {
    console.error('keepalive failed', err)
    sendJson(res, 500, { ok: false, message: err.message })
  }
}
