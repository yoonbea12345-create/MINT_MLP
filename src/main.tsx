import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorLogging } from './utils/errorLog'

initErrorLogging()

// 모바일 브라우저 UI가 접히거나 전체화면으로 전환될 때 실제 가시 높이를 앱 레이아웃에 즉시 반영한다.
let fullscreenNoticeGuard = 0
let fullscreenNoticeTimer: ReturnType<typeof setTimeout> | null = null

function syncAppViewportHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty(
    '--mint-app-height',
    `${Math.max(480, Math.round(height - fullscreenNoticeGuard))}px`,
  )
}

syncAppViewportHeight()
window.addEventListener('resize', syncAppViewportHeight)
window.visualViewport?.addEventListener('resize', syncAppViewportHeight)
document.addEventListener('fullscreenchange', () => {
  if (fullscreenNoticeTimer) clearTimeout(fullscreenNoticeTimer)
  // Android/Chrome의 강제 전체화면 안내가 하단 CTA를 가리는 동안만 버튼 영역을 위로 피한다.
  fullscreenNoticeGuard = document.fullscreenElement ? 104 : 0
  requestAnimationFrame(syncAppViewportHeight)
  if (document.fullscreenElement) {
    fullscreenNoticeTimer = setTimeout(() => {
      fullscreenNoticeGuard = 0
      syncAppViewportHeight()
    }, 4200)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
