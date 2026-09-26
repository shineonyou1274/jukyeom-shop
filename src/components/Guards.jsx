import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="container page"><p className="muted">불러오는 중…</p></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

export function RequireAdmin({ children }) {
  const { isAdmin, loading, profile, user } = useAuth()
  if (loading || (user && !profile)) return <div className="container page"><p className="muted">불러오는 중…</p></div>
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
