import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorLogging } from './utils/errorLog'

initErrorLogging()

// 모바일 브라우저 UI가 접히거나 펼쳐질 때 실제 가시 높이를 앱 레이아웃에 즉시 반영한다.
// 전체화면 안내를 피하려고 104px을 비워두던 보정은 걷어냈다 — 애초에 전체화면을 부르지 않으니
// 가릴 팝업도 없고, 그 보정은 정상 화면에서 CTA를 괜히 띄워 올리기만 했다.
function syncAppViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty(
    '--mint-app-height',
    `${Math.max(480, Math.round(height))}px`,
  )
}

syncAppViewportHeight()
window.addEventListener('resize', syncAppViewportHeight)
window.visualViewport?.addEventListener('resize', syncAppViewportHeight)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
