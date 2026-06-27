import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

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
          // fallback: Android 通常 24dp
          const dp = window.innerWidth < 600 ? 24 : 0
          const px = dp * (window.devicePixelRatio || 2)
          document.documentElement.style.setProperty('--status-bar-height', px + 'px')
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
