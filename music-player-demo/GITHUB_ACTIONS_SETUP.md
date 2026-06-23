# GitHub Actions APK 自动打包配置指南

## 快速开始

### 1. 创建 GitHub 仓库并上传代码

```bash
# 在 GitHub 上创建新仓库（假设名为 music-player）

# 添加远程仓库
git remote add origin https://github.com/你的用户名/music-player.git

# 推送代码
git branch -M main
git push -u origin main
```

### 2. 生成 Android 签名密钥（Release 包需要）

```bash
# 生成 keystore 文件
keytool -genkey -v -keystore music-player.keystore -alias musicplayer -keyalg RSA -keysize 2048 -validity 10000

# 将 keystore 转为 base64（用于 GitHub Secrets）
base64 -i music-player.keystore -o keystore.base64.txt
```

> 记住你设置的密码和 alias，下一步需要用到。

### 3. 配置 GitHub Secrets

进入 GitHub 仓库页面 → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`，添加以下 4 个 secret：

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | `keystore.base64.txt` 的内容 | keystore 文件的 base64 编码 |
| `ANDROID_KEYSTORE_PASSWORD` | 你设置的 keystore 密码 | 密钥库密码 |
| `ANDROID_KEY_ALIAS` | `musicplayer` | 密钥别名 |
| `ANDROID_KEY_PASSWORD` | 你设置的 key 密码 | 密钥密码（通常和 keystore 密码相同）|

### 4. 触发构建

#### 方式一：自动构建（推送到 main 分支）
每次 push 到 `main` 或 `master` 分支时，会自动构建 Debug APK。

#### 方式二：手动触发
进入 GitHub 仓库 → `Actions` → `Build Android APK` → `Run workflow`，可以选择构建 `debug` 或 `release`。

#### 方式三：发布 Release（自动签名 + 发布）
```bash
# 打标签并推送，会自动构建 Release APK 并创建 GitHub Release
git tag v1.0.0
git push origin v1.0.0
```

### 5. 下载 APK

构建完成后：
- **Debug APK**: Actions 页面 → 点击最新运行 → Artifacts 中下载 `android-debug-apk`
- **Release APK**: Actions 页面 → Artifacts 中下载，或直接在 GitHub Releases 页面下载

## 构建流程说明

```
Push 代码 / 手动触发
    ↓
检出代码
    ↓
安装 Node.js 依赖 (npm ci)
    ↓
构建 Web 应用 (npm run build)
    ↓
安装 JDK 17 + Android SDK
    ↓
同步 Capacitor (npx cap sync android)
    ↓
构建 APK (Gradle)
    ↓
上传 Artifact / 发布 Release
```

## 版本号规则

- `v1.0.0` - 正式版
- `v1.0.0-beta.1` - 测试版（标记为 prerelease）
- `v1.0.0-alpha.1` - 内测版（标记为 prerelease）

## 常见问题

### Q: Debug 和 Release 的区别？
- **Debug**: 未签名，仅供测试，可直接安装
- **Release**: 使用你的密钥签名，可上传到应用商店

### Q: 如何只构建 Debug 包？
直接 push 到 main 分支，或手动触发时选择 `debug`。

### Q: 没有 keystore 怎么办？
如果不配置 Secrets，Release 构建会失败。可以先只用 Debug 包测试：
1. 不配置任何 Secrets
2. push 到 main 分支自动构建 Debug APK
3. 需要 Release 时再按步骤 2 生成 keystore

### Q: Actions 运行失败怎么排查？
进入 Actions 页面 → 点击失败的运行 → 查看具体步骤的日志。
