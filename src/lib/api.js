import { supabase } from './supabase'

// 로그인 토큰을 붙여 서버 함수(/api/*) 호출
export async function callApi(path, body) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || '요청을 처리하지 못했어요.')
  return json
}
