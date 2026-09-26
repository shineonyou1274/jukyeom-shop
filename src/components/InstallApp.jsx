import { useEffect, useState } from 'react'
import { Seal } from './Ink'

// 홈 화면에 앱으로 설치하기 (안드로이드·PC 크롬은 설치 창, 아이폰은 사파리 안내)
let deferred = null
const listeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e
    listeners.forEach((fn) => fn())
  })
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export function useInstall() {
  const [canPrompt, setCanPrompt] = useState(Boolean(deferred))
  useEffect(() => {
    const fn = () => setCanPrompt(true)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  const installed = typeof window !== 'undefined' && isStandalone()
  return {
    available: !installed && (canPrompt || isIOS()),
    ios: isIOS(),
    async install() {
      if (!deferred) return false
      deferred.prompt()
      await deferred.userChoice
      deferred = null
      setCanPrompt(false)
      return true
    },
  }
}

export function InstallButton({ className = 'link-btn' }) {
  const { available, ios, install } = useInstall()
  const [guide, setGuide] = useState(false)
  if (!available) return null
  return (
    <>
      <button type="button" className={className} onClick={() => (ios ? setGuide(true) : install())}>
        앱으로 설치
      </button>
      {guide && <IOSGuide onClose={() => setGuide(false)} />}
    </>
  )
}

// 휴대폰 하단 안내 띠 (닫으면 다시 안 보임)
export function InstallBanner() {
  const { available, ios, install } = useInstall()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('install-banner-closed') === '1' } catch { return false }
  })
  const [guide, setGuide] = useState(false)
  if (!available || hidden) return null
  const close = () => {
    setHidden(true)
    try { localStorage.setItem('install-banner-closed', '1') } catch { /* 무시 */ }
  }
  return (
    <div className="install-banner" role="region" aria-label="앱 설치 안내">
      <Seal size={34} />
      <p><b>천왕봉 죽염 앱</b><span>홈 화면에 두고 바로 주문하세요</span></p>
      <button type="button" className="btn btn-primary sm" onClick={() => (ios ? setGuide(true) : install())}>설치</button>
      <button type="button" className="link-btn install-close" aria-label="닫기" onClick={close}>×</button>
      {guide && <IOSGuide onClose={() => { setGuide(false); close() }} />}
    </div>
  )
}

function IOSGuide({ onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="아이폰 설치 방법" onClick={(e) => e.stopPropagation()}>
        <h2>아이폰에서 앱으로 설치하기</h2>
        <ol>
          <li>사파리 아래쪽의 <b>공유 버튼</b>(네모에 위쪽 화살표)을 누르세요.</li>
          <li><b>홈 화면에 추가</b>를 누르세요.</li>
          <li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 천왕봉 죽염 아이콘이 생겨요.</li>
        </ol>
        <p className="small muted">카카오톡 등 앱 안에서 열었다면, 먼저 사파리로 열어 주세요.</p>
        <button type="button" className="btn btn-primary block" onClick={onClose}>확인</button>
      </div>
    </div>
  )
}
