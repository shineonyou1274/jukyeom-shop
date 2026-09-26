import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { phoneFormat } from '../lib/format'

const KO_ERRORS = {
  'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요.',
  'Email not confirmed': '이메일 인증이 아직 안 됐어요. 메일함을 확인해 주세요.',
  'User already registered': '이미 가입된 이메일이에요.',
}
const ko = (msg) => KO_ERRORS[msg] || msg

function useNext() {
  const [params] = useSearchParams()
  const next = params.get('next')
  return next && next.startsWith('/') ? next : '/'
}

export function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const next = useNext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setError(ko(error.message))
    navigate(next, { replace: true })
  }

  return (
    <div className="container page auth">
      <h1>로그인</h1>
      <form onSubmit={submit} className="panel">
        <label>이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>비밀번호<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary block" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        <div className="auth-links">
          <Link to={`/signup?next=${encodeURIComponent(next)}`}>회원가입</Link>
          <Link to="/reset-password">비밀번호 찾기</Link>
        </div>
      </form>
    </div>
  )
}

export function Signup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const next = useNext()
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', password2: '' })
  const [agree, setAgree] = useState({ terms: false, privacy: false })
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={next} replace />

  const set = (k) => (e) => setForm({ ...form, [k]: k === 'phone' ? phoneFormat(e.target.value) : e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.')
    if (form.password !== form.password2) return setError('비밀번호 확인이 일치하지 않아요.')
    if (!agree.terms || !agree.privacy) return setError('필수 약관에 동의해 주세요.')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { name: form.name, phone: form.phone },
        emailRedirectTo: window.location.origin + next,
      },
    })
    setBusy(false)
    if (error) return setError(ko(error.message))
    if (data.session) navigate(next, { replace: true })
    else setSent(true) // 이메일 인증이 켜져 있는 경우
  }

  if (sent) {
    return (
      <div className="container page auth center">
        <h1>메일을 확인해 주세요</h1>
        <p><b>{form.email}</b>(으)로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료돼요.</p>
      </div>
    )
  }

  return (
    <div className="container page auth">
      <h1>회원가입</h1>
      <form onSubmit={submit} className="panel">
        <label>이름<input value={form.name} onChange={set('name')} required maxLength={30} autoComplete="name" /></label>
        <label>휴대폰<input value={form.phone} onChange={set('phone')} required inputMode="tel" placeholder="010-0000-0000" /></label>
        <label>이메일<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>비밀번호 (8자 이상)<input type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" /></label>
        <label>비밀번호 확인<input type="password" value={form.password2} onChange={set('password2')} required autoComplete="new-password" /></label>
        <div className="agree">
          <label className="check">
            <input type="checkbox" checked={agree.terms && agree.privacy} onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked })} />
            <b>전체 동의</b>
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} />
            (필수) <Link to="/terms" target="_blank">이용약관</Link> 동의
          </label>
          <label className="check">
            <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} />
            (필수) <Link to="/privacy" target="_blank">개인정보 수집·이용</Link> 동의
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary block" disabled={busy}>{busy ? '가입 중…' : '가입하기'}</button>
        <div className="auth-links"><span className="muted">이미 회원이신가요?</span><Link to="/login">로그인</Link></div>
      </form>
    </div>
  )
}

// 비밀번호 찾기: 메일 발송 → 메일 링크로 돌아오면 새 비밀번호 입력
export function ResetPassword() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function sendMail(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(ko(error.message))
    else setMsg('비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 주세요.')
  }

  async function update(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return setError(ko(error.message))
    alert('비밀번호를 바꿨어요.')
    navigate('/')
  }

  return (
    <div className="container page auth">
      <h1>{user ? '새 비밀번호 설정' : '비밀번호 찾기'}</h1>
      {user ? (
        <form onSubmit={update} className="panel">
          <label>새 비밀번호 (8자 이상)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary block">변경하기</button>
        </form>
      ) : (
        <form onSubmit={sendMail} className="panel">
          <label>가입한 이메일<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {error && <p className="error">{error}</p>}
          {msg && <p className="notice">{msg}</p>}
          <button className="btn btn-primary block">재설정 메일 보내기</button>
        </form>
      )}
    </div>
  )
}
