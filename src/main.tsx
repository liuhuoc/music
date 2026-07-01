import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

// Prevent WebView back/forward navigation on native platforms
// This avoids page reloads caused by swipe gestures on Android
if (Capacitor.isNativePlatform()) {
  // Replace current history state to prevent back navigation
  if (window.history.length > 1) {
    window.history.replaceState(null, '', window.location.href)
  }

  // Push a state and intercept popstate to block back navigation
  window.history.pushState(null, '', window.location.href)
  window.addEventListener('popstate', () => {
    window.history.pushState(null, '', window.location.href)
  })
}

function StatusBarInit() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      // 获取真实状态栏高度
      StatusBar.getInfo()
        .then(info => {
          const height = info.height || 0
          document.documentElement.style.setProperty('--status-bar-height', height + 'px')
        })
        .catch(() => {
          // fallback: Android 状态栏通常约 24px (CSS 像素)
          const height = window.innerWidth < 600 ? 24 : 0
          document.documentElement.style.setProperty('--status-bar-height', height + 'px')
        })
    }
  }, [])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StatusBarInit />
    <App />
  </StrictMode>,
)
