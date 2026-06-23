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
      // 获取状态栏高度并设置 CSS 变量
      // Android 状态栏通常 24dp，在 WebView 中通过 JS 获取
      const setStatusBarHeight = () => {
        // 使用 window.innerHeight 和屏幕高度的差值来计算
        // 或者直接使用固定值
        const height = window.innerWidth < 600 ? 24 : 0; // dp
        const px = height * (window.devicePixelRatio || 2);
        document.documentElement.style.setProperty('--status-bar-height', px + 'px')
      }
      setStatusBarHeight()
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
