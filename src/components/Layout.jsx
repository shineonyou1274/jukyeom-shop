import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { STORE } from '../config/store'
import { Seal } from './Ink'
import { InstallBanner, InstallButton } from './InstallApp'

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const { pathname, hash } = useLocation()

  // 페이지를 옮기면 맨 위로 (#후기 처럼 위치가 지정된 경우는 제외)
  useEffect(() => { if (!hash) window.scrollTo(0, 0) }, [pathname, hash])

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
              <>
                <NavLink to="/order/lookup" className="hide-sm">주문조회</NavLink>
                <NavLink to="/login">로그인</NavLink>
              </>
            )}
            <NavLink to="/location" className="hide-sm">오시는 길</NavLink>
            <NavLink to="/cart" className="cart-link" aria-label={`장바구니${count ? ` ${count}개` : ''}`}>
              <CartIcon />
              {count > 0 && <span className="badge-count">{count}</span>}
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <InstallBanner />

      <footer className="footer">
        <div className="container">
          <div className="footer-links">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy"><b>개인정보처리방침</b></Link>
            <Link to="/refund">배송·교환·반품</Link>
            <Link to="/location">오시는 길</Link>
            <InstallButton className="link-btn footer-install" />
          </div>
          <p>
            상호 {STORE.name} · 대표 {STORE.owner} · 사업자등록번호 {STORE.bizNo} · 통신판매업신고 {STORE.mailOrderNo}{' '}
            <a href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${STORE.bizNo.replace(/-/g, '')}`} target="_blank" rel="noreferrer" className="biz-check">[사업자정보확인]</a>
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

function CartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2.2l2.1 10.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6.1" />
      <circle cx="9.5" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </svg>
  )
}
