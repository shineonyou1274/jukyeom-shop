import { Link, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { RequireAdmin, RequireAuth } from './components/Guards'
import SetupNotice from './components/SetupNotice'
import { isConfigured } from './lib/supabase'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import { PaymentFail, PaymentSuccess } from './pages/PaymentResult'
import { Login, ResetPassword, Signup } from './pages/Auth'
import MyPage from './pages/MyPage'
import Admin from './pages/Admin'
import { Privacy, Terms } from './pages/Policy'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        {!isConfigured ? (
          <Route path="*" element={<SetupNotice />} />
        ) : (
          <>
            <Route index element={<Home />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:id" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
            <Route path="payment/success" element={<RequireAuth><PaymentSuccess /></RequireAuth>} />
            <Route path="payment/fail" element={<PaymentFail />} />
            <Route path="login" element={<Login />} />
            <Route path="signup" element={<Signup />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="mypage" element={<RequireAuth><MyPage /></RequireAuth>} />
            <Route path="admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="*" element={<div className="container page narrow center"><h1>페이지를 찾을 수 없어요</h1><Link to="/" className="btn btn-primary">홈으로</Link></div>} />
          </>
        )}
      </Route>
    </Routes>
  )
}
