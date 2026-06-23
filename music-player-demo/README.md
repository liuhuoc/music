# Music Player

基于 React + TypeScript + Vite 的音乐播放器，支持 Web 和 Android 平台。

## 功能特性

- 灵动岛 Mini Player 设计
- 半悬浮播放列表和下载管理面板
- 网易云音乐 API 集成（搜索、播放、歌词、排行榜）
- API 不可用时自动降级为本地模拟数据
- 深色主题，薄荷绿强调色
- 收藏、评论、定时关闭、分享等功能

## 技术栈

- **前端**: React 19 + TypeScript + Vite
- **样式**: CSS-in-JS（内联样式）+ CSS 变量
- **Android**: Capacitor 6
- **CI/CD**: GitHub Actions（自动构建 APK）

## 快速开始

### Web 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

### 接入网易云 API（可选）

1. 安装并启动 NeteaseCloudMusicApi：
```bash
npx NeteaseCloudMusicApi@latest
```

2. Vite 代理已配置好（`vite.config.ts`），前端请求会自动通过代理转发到本地 API 服务。

### Android 开发

```bash
# 构建 Web 资源并同步到 Android
npm run build
npx cap sync android

# 用 Android Studio 打开
npx cap open android

# 或命令行构建 APK
cd android && ./gradlew assembleDebug
```

APK 输出路径：`android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions 自动构建

推送代码到 GitHub 后，Actions 会自动构建 APK。

### 触发条件

- 推送到 `main` 分支
- 创建 `v*` 标签（会同时创建 GitHub Release）
- 手动触发（workflow_dispatch）

### 下载 APK

1. 进入 GitHub 仓库的 **Actions** 页面
2. 点击最新的 workflow run
3. 在 **Artifacts** 区域下载 `android-debug-apk` 或 `android-release-apk`

### 通过 Tag 发布

```bash
git tag v1.0.0
git push origin v1.0.0
```

这会自动构建 APK 并创建 GitHub Release，APK 会作为 Release Assets 上传。

## 推送到 GitHub

```bash
# 1. 创建 GitHub 仓库（需要先安装 gh CLI 并登录）
gh repo create music-player --public --source=. --push

# 或者手动添加 remote
git remote add origin https://github.com/<你的用户名>/music-player.git
git push -u origin main
```

## 项目结构

```
music-player-demo/
├── src/
│   ├── components/          # UI 组件
│   │   ├── HomePage.tsx     # 首页（排行榜）
│   │   ├── SearchPage.tsx   # 搜索页
│   │   ├── FullPlayer.tsx   # 全屏播放器
│   │   ├── MiniPlayer.tsx   # 灵动岛迷你播放器
│   │   ├── QueuePage.tsx    # 播放列表
│   │   ├── DownloadPage.tsx # 下载管理
│   │   ├── ActionSheet.tsx  # 操作面板
│   │   ├── CommentsPanel.tsx# 评论面板
│   │   ├── TimerPanel.tsx   # 定时关闭
│   │   ├── Toast.tsx        # 提示消息
│   │   └── Icons.tsx        # 图标组件
│   ├── hooks/
│   │   └── usePlayer.ts     # 播放器状态管理
│   ├── services/
│   │   └── musicApi.ts      # 网易云 API 服务层
│   ├── data/
│   │   └── songs.ts         # 模拟数据
│   └── App.tsx              # 根组件
├── android/                 # Android 原生项目
├── .github/workflows/
│   └── build-android.yml   # GitHub Actions 配置
├── capacitor.config.ts     # Capacitor 配置
└── vite.config.ts           # Vite 配置（含 API 代理）
```

## 配置说明

### Android 包名

默认包名：`com.musicplayer.app`，在 `capacitor.config.ts` 中修改。

### API 代理

Vite 开发服务器将 `/ncm` 路径代理到本地 NeteaseCloudMusicApi 服务（`localhost:3001`）。

### 环境变量

无需额外环境变量配置。如需使用公共网易云 API 实例，修改 `src/services/musicApi.ts` 中的 `API_BASE` 即可。
