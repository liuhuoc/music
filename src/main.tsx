import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'

// 初始化状态栏（Android 原生平台）
function StatusBarInit() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // 设置状态栏为透明，让内容延伸到状态栏下方
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
      // 设置状态栏文字为亮色（深色背景）
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      // Android 状态栏高度约 24-28dp（约 32px），直接设置 CSS 变量
      document.documentElement.style.setProperty('--safe-area-top', '32px')
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
