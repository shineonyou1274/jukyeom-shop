import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Stars } from './Reviews'

// 메인 화면: 최근 구매 후기 (후기가 있을 때만 보인다)
export default function RecentReviews() {
  const [reviews, setReviews] = useState([])
  useEffect(() => {
    supabase.from('reviews').select('id, rating, content, image_url, author_name, product_id, products(name)')
      .eq('is_hidden', false).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setReviews(data || []))
  }, [])
  if (reviews.length === 0) return null
  return (
    <section className="container section">
      <div className="section-head"><h2>구매 후기</h2></div>
      <div className="review-cards">
        {reviews.map((r) => (
          <Link key={r.id} to={`/products/${r.product_id}#reviews`} className="review-card">
            {r.image_url && <img src={r.image_url} alt="" loading="lazy" />}
            <Stars value={r.rating} />
            <p>{r.content.length > 90 ? `${r.content.slice(0, 90)}…` : r.content}</p>
            <span className="small muted">{r.author_name} · {r.products?.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
