# AstroBot Control — 手机上的机器人任务控制台

把你的 [AstrBot](https://docs.astrbot.app/) 网页控制台变成一个原生安卓应用:在手机上随时查看机器人状态、和它对话、看日志、管插件。

![AstroBot Control](app/res/icon-512.png)

## 安装(手机)

1. 把 `AstroBot-Control.apk` 传到手机(微信/QQ 发送、USB、网盘均可)
2. 在手机上点开 APK,允许"安装未知来源应用"
3. 打开 App,填入服务器地址、用户名和密码登录(支持任何 AstrBot 实例,含 `http://192.168.x.x` 局域网部署)

> 需要安卓 7.0+(Android 7.0,2016 年后的手机都满足),且系统 WebView 为较新版本(绝大多数手机自动更新,无需操心)。

## 功能

| 页面 | 能做什么 |
|------|---------|
| **总览** | 活动圆环(CPU/内存/运行时长)、消息总数、今日 Token、24 小时消息趋势、平台消息排行,60 秒自动刷新;**AI 模型区块**:1/3/7 天切换、成功率/平均首字/平均耗时、模型调用趋势图、模型用量排名、会话用量 Top10 |
| **对话** | 与机器人流式对话,支持思考过程折叠、Markdown/代码块、图片、多会话管理、切换模型提供方、停止生成 |
| **日志** | 实时日志流(SSE),按级别筛选,自动滚动/手动暂停,断线自动重连 |
| **插件** | 已安装/市场分段:已安装启停+搜索;**插件市场**搜索、按下载量排序、一键安装(已装标记) |
| **配置** | 与官方 WebUI 同款表单:官方元数据驱动"组→小节→字段",全中文(打包官方翻译表);枚举选择、开关、数值、密钥掩码、列表/字典编辑、条件显隐、更多配置折叠;模型/人格/知识库选择器从接口拉候选;高级原始树、JSON 模式、profile 管理 |
| **我的** | 服务器状态、消息平台启停、**机器人管理入口**(人格设定/定时任务/对话记录/模型提供方)、修改密码、重启核心、退出 |
| ↳ 人格设定 | 人格列表、新建、编辑系统提示词、删除 |
| ↳ 定时任务 | 任务列表、启停、立即运行、删除、新建(cron 预设/提示词/投递会话) |
| ↳ 对话记录 | 全平台历史会话,筛选私聊/群聊,分页,点开查看消息记录 |
| ↳ 模型提供方 | 按 对话/STT/TTS/嵌入/重排 分类,启停、测试连接 |
| ↳ 设置 | **外观主题(跟随系统/浅色/深色,全程深色模式)**、思考过程默认展开、流式输出开关、总览自动刷新频率、切换服务器、检查 AstrBot 更新、重置应用 |

另有**演示模式**:登录页点"先看看演示模式"可无服务器体验全部界面。

## 设计说明

Apple 设计语言(iOS HIG):浅色分组背景(`#F2F2F7`)、白色圆角卡片、iOS Blue 主色(`#007AFF`);大标题导航在滚动时收缩为小标题,顶栏与 Tab 栏为磨砂玻璃材质;总览页是 Apple Fitness 风格的**活动圆环**(外环 CPU 蓝色、内环内存紫色、中心运行时长);对话页为 iMessage 式气泡(蓝色渐变出站、浅灰入站);日志筛选为 iOS 分段控件;开关为标准 iOS 绿色 Switch;确认框为 iOS Alert 式磨砂弹窗。

## 技术架构

```
app/
├── assets/www/          # HTML5 应用本体(零依赖,无框架)
│   ├── index.html       # 页面骨架:登录层 + 5 页 + 底部 tab
│   ├── css/style.css    # 设计系统(颜色/字体/组件)
│   └── js/              # util(DOM/浮层/Markdown/图表)
│                        # api(AstrBot REST + SSE 流 + 演示拦截)
│                        # page-*(5 个页面模块,各自管理生命周期)
│                        # main(路由 + 登录流程)
├── java/.../MainActivity.java  # WebView 壳:放行跨域直连任意实例
├── res/                 # 自适应启动图标(星轨)
└── AndroidManifest.xml  # minSdk 24 / targetSdk 35,允许 http 局域网
```

要点:

- **跨域直连**:AstrBot API 不发 CORS 头,浏览器里跨域调用会被拦。App 用 WebView 的 `setAllowUniversalAccessFromFileURLs` 放行,因此可以直连任何实例(包括 `http://192.168.x.x` 局域网部署)。
- **接口协议**:对接 AstrBot v1 API(`POST /api/v1/auth/login`、`GET /api/v1/stats`、`POST /api/v1/chat` SSE 流、`GET /api/v1/logs/live` SSE 等),旧版实例自动回退 `/api/auth/login`。
- **手工构建链**:不依赖 Gradle/Android Studio,用 aapt2 + javac + d8 + apksigner 直接出包(见下)。

## 重新构建 APK

前置:JDK 17+(需 `java`/`javac`/`keytool`/`jar`)、`.sdk/` 下的 build-tools 34 与 platform-35(已包含在本目录)。

```bash
bash scripts/build-apk.sh
# 产物:AstroBot-Control.apk(已用 astrobot-release.keystore 签名)
```

改界面只需编辑 `app/assets/www/` 下的文件后重跑脚本;改图标运行 `node scripts/make-icon.js`。

签名密钥 `astrobot-release.keystore` 口令为 `astbot2024`——密钥文件**不入库**(见 `.gitignore`),**正式长期使用请换成自己的密钥并妥善保管**(换密钥后需先卸载旧版再安装)。

## 热更新(Web 层)

界面资源支持免重装热更新:App 启动时静默检查 GitHub Releases(12 小时节流,设置页可手动检查),有新版即下载解压到应用内部存储并优先加载,失败自动回落 APK 内置版本。原生壳(`app/java/`、Manifest、图标)变更仍需重装 APK(递增 `versionCode`)。

```bash
bash scripts/publish-web.sh "更新说明"   # 打包 www → 发布 Release,版本号自动 +1(记录在 web-version 文件)
```

## 目录约定

- `AstroBot-Control.apk` — 交付产物(不入库)
- `app/` — 应用源码(HTML + Java + 资源)
- `scripts/` — 构建、图标与热更新发布脚本
- `web-version` — 热更新版本计数(随仓库走,发布脚本自动递增)
- `.sdk/` — Android 构建工具(腾讯镜像下载,约 120MB,不入库)
- `astrobot-release.keystore` — 签名密钥(不入库)
