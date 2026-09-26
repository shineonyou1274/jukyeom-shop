import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { STORE } from '../config/store'
import { Seal } from './Ink'

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo" aria-label="천왕봉 죽염 홈">
            <Seal size={34} />
            <span>천왕봉 죽염</span>
          </Link>
          <nav className="nav">
            <NavLink to="/products" className="hide-sm">전체상품</NavLink>
            {isAdmin && <NavLink to="/admin">관리자</NavLink>}
            {user ? (
              <>
                <NavLink to="/mypage">내 주문</NavLink>
                <button className="link-btn" onClick={async () => { await signOut(); navigate('/') }}>로그아웃</button>
              </>
            ) : (
              <NavLink to="/login">로그인</NavLink>
            )}
            <NavLink to="/cart" className="cart-link">
              장바구니{count > 0 && <span className="badge-count">{count}</span>}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-links">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy"><b>개인정보처리방침</b></Link>
            <Link to="/refund">교환·환불 정책</Link>
          </div>
          <p>
            상호 {STORE.name} · 대표 {STORE.owner} · 사업자등록번호 {STORE.bizNo} · 통신판매업신고 {STORE.mailOrderNo}
            <br />
            주소 {STORE.address} · 고객센터 {STORE.phone}{STORE.mobile && ` / ${STORE.mobile}`} ({STORE.csHours}) · {STORE.email}
            <br />
            개인정보 보호책임자 {STORE.privacyOfficer}
          </p>
          <p className="copyright">© {new Date().getFullYear()} {STORE.name}</p>
        </div>
      </footer>
    </div>
  )
}
