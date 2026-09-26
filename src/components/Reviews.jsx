import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function Stars({ value, size = 16 }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>)}
    </span>
  )
}

export const reviewSummary = (reviews) => {
  const visible = (reviews || []).filter((r) => !r.is_hidden)
  const avg = visible.length ? visible.reduce((s, r) => s + r.rating, 0) / visible.length : 0
  return { count: visible.length, avg }
}

const fmtDate = (s) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

// 상품 상세의 후기 목록 + 작성 (구매한 회원만)
export default function Reviews({ productId, reviews, onChange }) {
  const { user } = useAuth()
  const location = useLocation()
  const [canWrite, setCanWrite] = useState(false)
  const [editing, setEditing] = useState(false)
  const mine = user && reviews.find((r) => r.user_id === user.id)
  const { count, avg } = reviewSummary(reviews)

  useEffect(() => {
    if (location.hash === '#reviews') setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }), 300)
  }, [location.hash])

  useEffect(() => {
    if (!user) return setCanWrite(false)
    supabase.rpc('has_purchased', { p_product_id: productId }).then(({ data }) => setCanWrite(Boolean(data)))
  }, [user, productId])

  return (
    <section className="description reviews" id="reviews">
      <div className="reviews-head">
        <h2>구매 후기 <span className="muted">{count}</span></h2>
        {count > 0 && <p className="review-avg"><Stars value={avg} size={18} /> <b>{avg.toFixed(1)}</b></p>}
      </div>

      {!user ? (
        <p className="small muted">구매하신 회원은 후기를 남길 수 있어요. <Link to={`/login?next=${encodeURIComponent(location.pathname + '#reviews')}`}>로그인</Link></p>
      ) : mine && !editing ? null : canWrite ? (
        <ReviewForm productId={productId} userId={user.id} initial={editing ? mine : null}
          onDone={() => { setEditing(false); onChange() }} onCancel={editing ? () => setEditing(false) : null} />
      ) : (
        <p className="small muted">이 상품을 구매하신 뒤에 후기를 남길 수 있어요.</p>
      )}

      {count === 0 && !mine ? (
        <p className="muted">아직 후기가 없어요. 첫 후기를 남겨 주세요.</p>
      ) : (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review">
              <div className="review-top">
                <Stars value={r.rating} />
                <span className="small muted">{r.author_name} · {fmtDate(r.created_at)}</span>
                {r.is_hidden && <span className="status s-cancelled">숨김 처리됨</span>}
              </div>
              <p className="pre">{r.content}</p>
              {r.image_url && <a href={r.image_url} target="_blank" rel="noreferrer"><img src={r.image_url} alt="후기 사진" className="review-img" loading="lazy" /></a>}
              {user?.id === r.user_id && (
                <div className="review-own small">
                  <button type="button" className="link-btn" onClick={() => setEditing(true)}>수정</button>
                  <button type="button" className="link-btn" onClick={async () => {
                    if (!confirm('후기를 삭제할까요?')) return
                    await supabase.from('reviews').delete().eq('id', r.id)
                    onChange()
                  }}>삭제</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReviewForm({ productId, userId, initial, onDone, onCancel }) {
  const [rating, setRating] = useState(initial?.rating ?? 5)
  const [content, setContent] = useState(initial?.content ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setError('사진은 5MB 이하로 올려 주세요.')
    setBusy(true)
    const path = `${userId}/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('review-images').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) return setError(error.message)
    setImageUrl(supabase.storage.from('review-images').getPublicUrl(path).data.publicUrl)
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (content.trim().length < 5) return setError('후기를 5자 이상 적어 주세요.')
    setBusy(true)
    const row = { rating, content: content.trim(), image_url: imageUrl || null }
    const { error } = initial
      ? await supabase.from('reviews').update(row).eq('id', initial.id)
      : await supabase.from('reviews').insert({ ...row, product_id: productId, user_id: userId })
    setBusy(false)
    if (error) return setError(error.code === '23505' ? '이미 후기를 남기셨어요.' : error.message)
    onDone()
  }

  return (
    <form className="panel review-form" onSubmit={submit}>
      <div className="star-pick" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
        <span className="small muted">{rating}점</span>
      </div>
      <textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} maxLength={1000}
        placeholder="맛, 쓰임새, 포장 등 사용해 보신 느낌을 남겨 주세요." />
      <div className="review-form-foot">
        <label className="btn btn-ghost sm file-btn">
          {imageUrl ? '사진 바꾸기' : '사진 추가'}
          <input type="file" accept="image/*" onChange={upload} hidden />
        </label>
        {imageUrl && <img src={imageUrl} alt="" className="review-thumb" />}
        {imageUrl && <button type="button" className="link-btn small muted" onClick={() => setImageUrl('')}>사진 빼기</button>}
        <span className="grow" />
        {onCancel && <button type="button" className="btn btn-ghost sm" onClick={onCancel}>취소</button>}
        <button className="btn btn-primary sm" disabled={busy}>{initial ? '수정하기' : '후기 등록'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
