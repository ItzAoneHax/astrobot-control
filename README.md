# AstroBot Control

AstrBot 聊天机器人的 Android 控制台客户端。原生 WebView 壳加载零依赖 HTML5 应用本体,通过 AstrBot HTTP API 完成登录鉴权与全部管理操作,支持 Web 层热更新。

## 功能

| 模块 | 说明 |
| --- | --- |
| 仪表盘 | 机器人运行状态、活动统计圆环、自动刷新 |
| 日志 | 历史日志查询 + 实时日志流(`/api/v1/logs/live`) |
| 对话 | 调用 `/api/v1/chat` SSE 流式对话,气泡式界面,偏好(人格、推理展开、流式开关)持久化 |
| 插件 | 插件列表、安装/更新/启停管理 |
| 配置 | AstrBot 平台配置元数据驱动的表单编辑(i18n / mock 元数据内置) |
| 我的 | 服务器连接设置、外观与偏好、检查更新 |
| 二级页 | 人格(Personas)、定时任务(Cron)、会话(Conversations)、提供商(Providers)、设置 |

- **深色模式**:`auto / light / dark` 三态,`body.dark` 覆盖 CSS 变量,状态栏颜色经 `AndroidBridge.setDark` 同步。
- **Web 热更新**:App 启动时拉取 `releases/latest/download/manifest.json` 比对版本,下载 `www.zip` 解压至 `filesDir/www` 并优先加载;静默检查 12 小时节流,设置页可手动触发,零新增权限。

## 架构

```
app/
├── AndroidManifest.xml        # versionCode 2 / versionName 1.1
├── java/cn/iepose/astrbot/
│   └── MainActivity.java      # WebView 壳:ThemeBridge / UpdateBridge / Updater(静态嵌套类)
├── res/                       # 自适应图标 + 主题样式
└── assets/www/                # HTML5 应用本体(零框架、零构建、零依赖)
    ├── index.html             # hash 路由:6 个 Tab + 5 个二级页
    ├── css/style.css          # iOS HIG 设计系统(#F2F2F7 / #007AFF / #34C759,磨砂材质、分组列表)
    └── js/                    # api / main / util + 按页拆分的 page-*.js
scripts/
├── build-apk.sh              # Windows(Git Bash)手工出包:aapt → javac → d8 → zipalign → apksigner
├── publish-web.sh            # 一键发布 Web 层 Release(www.zip + manifest.json)
└── make-icon.js              # 图标生成
web-version                   # Web 层版本计数,随仓库跟踪
```

原生层仅持有 `INTERNET` 与 `ACCESS_NETWORK_STATE` 两个权限。App 迭代集中在 `assets/www/`,经 GitHub Releases 分发;原生壳变更才需要重装 APK 并递增 `versionCode`。

## 构建 APK

环境要求:Windows + Git Bash,JDK 17+,`.sdk/` 内含 platform 35 的 `android.jar` 与 build-tools(`d8` / `zipalign` / `apksigner`)。

```bash
bash scripts/build-apk.sh
```

脚本在无空格暂存目录执行 d8(规避其对含空格路径的 bug),产物为根目录 `AstroBot-Control.apk`,首次运行自动生成签名密钥。

## 发布 Web 更新

```bash
bash scripts/publish-web.sh "更新说明"
```

自动递增 `web-version`,打包 `assets/www/` 为 `www.zip`,连同 `manifest.json` 创建 GitHub Release;已安装的 App 在下次检查时自动获取。

## 许可

私有项目,保留所有权利。
