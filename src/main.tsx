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
      // 不覆盖 WebView，让状态栏有独立背景色
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
      // 设置状态栏文字为亮色（深色背景）
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      // 设置状态栏背景色与应用主题一致
      StatusBar.setBackgroundColor({ color: '#0a0a1a' }).catch(() => {})
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
