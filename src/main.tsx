import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorLogging } from './utils/errorLog'

initErrorLogging()

// 모바일 브라우저 UI가 접히거나 전체화면으로 전환될 때 실제 가시 높이를 앱 레이아웃에 즉시 반영한다.
function syncAppViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--mint-app-height', `${Math.round(height)}px`)
}

syncAppViewportHeight()
window.addEventListener('resize', syncAppViewportHeight)
window.visualViewport?.addEventListener('resize', syncAppViewportHeight)
document.addEventListener('fullscreenchange', () => requestAnimationFrame(syncAppViewportHeight))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
