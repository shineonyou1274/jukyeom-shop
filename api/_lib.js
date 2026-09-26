import { createClient } from '@supabase/supabase-js'

export const SHIPPING_FEE = 3000
export const FREE_SHIPPING_THRESHOLD = 30000

let admin
export function supabaseAdmin() {
  if (!admin) {
    const url = process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new HttpError(500, '서버 설정(SUPABASE_SERVICE_ROLE_KEY)이 비어 있어요.')
    admin = createClient(url, key, { auth: { persistSession: false } })
  }
  return admin
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

// Authorization: Bearer <supabase access token> 로 로그인한 회원 확인
export async function requireUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, '로그인이 필요해요.')
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data?.user) throw new HttpError(401, '로그인이 만료됐어요. 다시 로그인해 주세요.')
  return data.user
}

export async function requireAdmin(req) {
  const user = await requireUser(req)
  const { data } = await supabaseAdmin().from('profiles').select('is_admin').eq('id', user.id).single()
  if (!data?.is_admin) throw new HttpError(403, '관리자만 할 수 있어요.')
  return user
}

export function tossAuthHeader() {
  const secret = process.env.TOSS_SECRET_KEY
  if (!secret) throw new HttpError(500, '서버 설정(TOSS_SECRET_KEY)이 비어 있어요.')
  return 'Basic ' + Buffer.from(secret + ':').toString('base64')
}

// POST 전용 핸들러 래퍼: 에러를 JSON으로 돌려준다
export function postHandler(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 405, { message: 'POST만 허용돼요.' })
    try {
      const body = await readJson(req)
      sendJson(res, 200, await fn(req, body))
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error(err)
      sendJson(res, status, { message: err.message || '알 수 없는 오류가 발생했어요.' })
    }
  }
}
