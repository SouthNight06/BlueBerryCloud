# 小云畅听 · Cloud Music

<img src="web/public/icon-512.png" width="128" alt="小云畅听图标" />

> 小云屋出品的多端音乐播放器。默认主题「蓝莓与云朵」。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.5-3c873a.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-5b6ee1.svg)](#平台支持)

小云畅听是一个自托管的轻量音乐播放器：浏览器、桌面端、Android 共用同一套前端与同一份数据。它不依赖任何商业音乐服务，曲库由你自己导入、同步或从公开来源获取；账号、歌单、歌词、主题、播放偏好全部保存在你自己部署的服务器上。

界面走安静克制的路线：圆角、留白、细腻的层次与柔和的高光，中文字形使用猫啃珠圆体，英文字形回退到 Comic Sans，所有歌词与标题统一由 `--font-cute` 变量驱动。

> 小云说：v1.0.4 给播放条镶了一条会呼吸的波形。它只跟着音乐起伏，不抢戏；DJ 模式也重学了节奏感——鼓点落下时先把整块界面轻轻压扁，再一口气弹回来，该弹的地方一次都不会漏。

---

## 目录

- [功能特性](#功能特性)
- [平台支持](#平台支持)
- [技术栈](#技术栈)
- [仓库结构](#仓库结构)
- [快速开始](#快速开始)
- [环境变量](#环境变量)
- [构建与发布](#构建与发布)
- [数据与隐私](#数据与隐私)
- [免责声明](#免责声明)
- [致谢](#致谢)
- [字体许可](#字体许可)
- [许可证](#许可证)

---

## 功能特性

### 播放与曲库

- 本地音频导入（MP3 / FLAC / WAV / OGG / M4A / AAC / OPUS），标题、艺人与专辑可随时修改。
- 公开来源检索与下载，导入后进入自己的曲库。
- 歌单创建、拖拽排序、增删曲目，歌单数据随账号在服务端同步。
- 底部播放条、播放队列、随机播放与单曲/列表循环。
- 播放条顶部有一条韵律波形：56 段对数频带覆盖 36 Hz–14 kHz，实时跟着音乐起伏，窄屏自动降密度，跟随主题色，暂停时淡出。
- 音量平衡开关：基于 Web Audio `AnalyserNode` 实时测量 RMS，动态调整 `GainNode`，让响度差异大的曲目听起来更接近。

### 哔哩哔哩

- 扫码登录哔哩哔哩，服务端保存登录态，展示头像、昵称、UID 与大会员状态。
- 浏览自己的收藏夹，分页展示视频与音频条目。
- 单曲下载、整夹一键下载、多 P 视频选集下载。
- 自动挑选 `dash.audio` 中最高码率的音轨，落盘入库并写入封面。
- 登录态失效时在设置页提示重新扫码，支持随时解绑账号。

### 歌词

- 在线检索：按标题、艺人、时长匹配 lrclib.net 歌词，选中后写入曲目。
- 本地导入：直接粘贴或导入 `.lrc` 文本，支持标准时间轴。
- 内置编辑器：逐行修改时间戳，实时预览滚动效果。
- AI 生成：在服务端配置任意 OpenAI 兼容接口后，可按曲目信息生成初版歌词，再人工校对。
- 桌面歌词浮层：可拖拽，位置限制在可视区域内并持久化保存；当前行按播放进度做渐变扫光，换行时轻量入场。

### 主题与外观

- 内置多套主题，支持导入用户自制主题 JSON。
- 主题变量覆盖颜色、圆角、阴影与光晕，切换即时生效。
- 全局可爱字体：正文、标题、按钮、输入框、开关、播放条、桌面歌词统一使用 `--font-cute` 字体链（猫啃珠圆体 + Comic Sans 回退），不再有零散的系统字体漏网。
- 数据全部落在本地存储与服务端设置中，换设备登录即可恢复。

### DJ 模式

- 设置 →「动效」里一键开关，偏好保存在服务端，换设备同样生效。
- 弹跳是「先压扁、再弹起」：鼓点落下时元素以底边为轴横向撑开、纵向压扁（这就是 q 弹的来源），约 1/4 拍后向上弹起并纵向拉伸，再落回原位，一次鼓点走完一整个循环。
- 同一处提供「DJ 强度」滑块（0.4×–2.4×），拖动时实时预览，松手才写入服务端，默认 1.6×。
- 播放时实时读取音频频谱：用低频谱通量做 onset 检测，配合自适应噪声地板与 150 ms 不应期，弱鼓点也能抓住，不会两拍并一拍；检测到长时间没有拍点时按上一拍间隔兜底补拍，安静段落则自动收敛。
- 节拍间隔由“上一拍到现在”的时间做指数平滑得出，压扁与弹起的时长随歌曲速度自适应（250–430 ms 一个循环），快歌利落、慢歌绵软。
- 字体、封面、按钮、歌单卡片、B 站卡片与桌面歌词都会跟着节拍压扁再弹起；波形图与 DJ 动效共用同一份分析结果，不会互相抢帧。
- 尊重系统「减少动态效果」设置：开启后自动停用全部弹跳，只保留静态界面。
- 弹跳只作用于 `translate` / `scale` 合成层，并直接写 CSS 变量驱动，不触发 React 重渲染，长列表滚动依旧流畅。
- 播放栏上方驻着一只桌宠（弦卷心立绘）：DJ 模式开启时出现，在播放条上方来回漫步，随机换向、碰边掉头，每隔几秒起跳一次；关掉 DJ 模式即隐藏。立绘保留透明背景，尺寸随窗口自适应，`pointer-events: none` 保证不遮挡任何点击；系统开启「减少动态效果」时只静止居中显示。

### 账号与设置

- 用户名注册与登录，密码使用 bcrypt 哈希，会话使用 JWT。
- 设置页集中管理：小云畅听账号、哔哩哔哩账号、声音、动效、歌词、缓存、关于与致谢。
- 缓存分三类统计与清理：封面缓存、音频文件、残留文件；音频文件属于曲库资产，清理缓存不会删除。

---

## 平台支持

| 平台 | 形态 | 说明 |
| --- | --- | --- |
| Windows | Electron 安装包（NSIS） | 桌面端 |
| macOS | Electron 安装包（DMG） | 桌面端 |
| Linux | Electron 应用（AppImage） | 桌面端 |
| Android | Capacitor 打包 APK | Android 6.0（API 23）及以上 |
| Web | 浏览器直接访问服务端 | 现代浏览器 |

桌面端内嵌服务端进程，开箱即用；Android 端与浏览器端连接你部署的服务端，可在登录页填写服务器地址。

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 18、TypeScript 5.7、Vite 5，自写 hash 路由与 Context 状态管理 |
| 音频 | 原生 `<audio>` + Web Audio API（`GainNode` / `AnalyserNode`） |
| 样式 | 原生 CSS 变量主题系统，无 UI 框架 |
| 移动端 | Capacitor 7 |
| 桌面端 | Electron 44 + electron-builder |
| 服务端 | Node.js 22、Express 4、`node:sqlite`、`multer`、`jsonwebtoken`、`bcryptjs` |
| 歌词 | 自写 LRC 解析器，在线数据源 lrclib.net，AI 走 OpenAI 兼容接口 |
| 哔哩哔哩 | 官方 Web 接口 + wbi 签名 + 扫码登录轮询 |

前端没有引入第三方路由、状态管理、音频或歌词库，所有能力都在仓库内实现，便于审阅与二次开发。

---

## 仓库结构

```
.
├── web/                    # React 前端（同时作为 Capacitor WebView 与 Electron 渲染层）
│   ├── src/
│   │   ├── screens/        # 页面：发现、曲库、歌单、主题、哔哩哔哩、设置
│   │   ├── components/     # 播放条、桌面歌词、歌词弹窗、图标等
│   │   ├── state/          # App / Player / Ui / Toast 四个 Store
│   │   ├── lib/            # LRC 解析、路由、主题、格式化
│   │   └── styles/         # base / ui / app 三层样式
│   ├── public/             # 图标、字体、Service Worker
│   └── android/            # Capacitor Android 工程
├── server/                 # Express 服务端
│   └── src/
│       ├── routes/         # auth / catalog / playlists / themes / lyrics / bilibili / cache / sync
│       ├── bilibili/       # 登录、wbi 签名、封面代理
│       ├── sources/        # 曲目来源适配
│       └── db.js           # sqlite 初始化与迁移
├── desktop/                # Electron 主进程与打包配置
└── .github/workflows/      # 三端构建与 Release 发布
```

---

## 快速开始

需要 Node.js **22.5 及以上**（服务端使用内置 `node:sqlite`）。

```bash
# 1. 启动服务端
cd server
npm install
npm start
# 默认监听 http://127.0.0.1:3001

# 2. 启动前端开发服务器
cd web
npm install
npm run dev
# 打开 http://127.0.0.1:5173，/api 与 /media 已代理到 3001
```

首次启动会在 `server/data/` 下生成 SQLite 数据库，并在 `server/media/demo/` 放置几首可离线播放的示例曲目，方便直接验证播放链路。

### 桌面端

```bash
cd web && npm run build
cd ../desktop
npm install
npm run build:server   # 用 esbuild 把服务端打成单文件
npm start
```

桌面端会把用户数据写入系统用户数据目录下的 `library/`，不会污染项目目录。

### Android

```bash
cd web
npm run build
npx cap sync android
npx cap open android
# 或在命令行直接出包
npm run android:apk
```

APK 内的前端会连接你在登录页填写的服务器地址；也可以构建时设置 `VITE_API_BASE` 作为默认地址。

### 手机端填写服务器地址（手把手）

APK 里只有前端，没有服务端。手机需要连到一台已经跑着小云畅听服务端的机器（通常是你的电脑），按下面六步走一遍就能通。

**第 1 步：让服务端愿意被局域网访问**

服务端默认只监听 `127.0.0.1`，也就是只有本机能连，手机一定连不上。启动时把 `HOST` 改成 `0.0.0.0`：

```bash
# Windows PowerShell
$env:HOST="0.0.0.0"; $env:PORT="3001"; node server/src/index.js

# macOS / Linux
HOST=0.0.0.0 PORT=3001 node server/src/index.js
```

看到 `小云畅听 API listening on http://0.0.0.0:3001` 就成功了。
注意：桌面端安装包里内嵌的服务端只监听本机、端口随机，**不能**给手机用，手机必须连一个这样单独启动的服务端。

**第 2 步：查电脑的局域网 IP**

| 系统 | 命令 | 找什么 |
| --- | --- | --- |
| Windows | `ipconfig` | 「无线局域网适配器 WLAN」或「以太网」下的 `IPv4 地址`，形如 `192.168.1.10` |
| macOS | `ipconfig getifaddr en0` | 输出的那一行 IP（有线网卡可能是 `en1`） |
| Linux | `hostname -I` | 第一个非 `127.0.0.1` 的地址 |

**第 3 步：确认手机和电脑在同一个 Wi-Fi**

手机 Wi-Fi 详情里看一眼分到的 IP，前三段应与电脑一致（比如都是 `192.168.1.x`）。
连路由器的「访客网络」通常会隔离设备，手机能上网却访问不到电脑，这种情况请切回主网络。

**第 4 步：放行防火墙的 3001 端口**

- Windows：首次运行 Node 会弹「是否允许访问网络」，务必勾上**专用网络**；错过了就到「Windows Defender 防火墙 → 允许应用通过防火墙」里补勾 Node.js。
- macOS：系统设置 → 网络 → 防火墙，允许 `node` 接受传入连接。
- Linux：`sudo ufw allow 3001/tcp`（启用了 ufw 的话）。

**第 5 步：先用手机浏览器验一次**

在手机浏览器打开：

```
http://192.168.1.10:3001/api/health
```

（把 IP 换成第 2 步查到的那个。）能看到一段 JSON 就说明网络通了，可以进下一步；打不开就回到第 1、3、4 步检查，此时填进 App 也一定连不上。

**第 6 步：在 App 里填地址**

1. 打开小云畅听 APK，停在登录页；
2. 点页面底部的灰字「尚未设置服务器地址」（填过之后会显示「服务器 · http://…」，同样点开可以修改）；
3. 输入 `http://192.168.1.10:3001`：
   - 要带 `http://`，端口要写（默认 `3001`）；
   - 不要带结尾斜杠，也不要写成 `/api/health`，只填到端口为止；
   - 不带 `http://` 时 App 会自动补上，但写明更保险；
4. 点「测试并保存」，App 会请求一次 `/api/health` 校验：
   - 显示「已连接，可以登录了」→ 地址正确，输入框会自动收起；
   - 显示「连不上这台服务器，检查地址和网络后再试」→ 依次核对第 1、2、3、4 步；
5. 之后正常注册或登录即可。

地址会存在手机本地，下次打开自动生效；想改就再点那行灰字。清空输入框再点「测试并保存」会恢复成构建时通过 `VITE_API_BASE` 写入的默认地址。

**想在外面（不同网络）也能用**：把服务端部署到有公网 IP 的服务器，用 Nginx 或 Caddy 反代并配好 HTTPS，手机端填 `https://你的域名`（不写端口、不写路径）。同时记得把 `HOST` 设为 `0.0.0.0`、用 `JWT_SECRET` 换掉默认值、并限制 `CORS_ORIGINS`。

---

## 环境变量

服务端读取以下变量，均可选：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `PORT` | `3001` | 监听端口，`0` 表示随机端口（桌面端使用） |
| `HOST` | `127.0.0.1` | 监听地址 |
| `XIAOYUN_DATA_DIR` | `server/` | 数据根目录，`data/`、`uploads/`、`media/` 都在其下 |
| `XIAOYUN_WEB_DIST` | `web/dist` | 前端构建产物目录，存在时服务端直接托管静态站点 |
| `CORS_ORIGINS` | `*` | 允许的来源，多个用逗号分隔 |
| `JWT_SECRET` | 开发用默认值 | 生产环境务必替换 |
| `MAX_UPLOAD_BYTES` | `209715200` | 单文件上传上限（200 MB） |
| `XIAOYUN_AI_BASE_URL` | 空 | OpenAI 兼容接口地址，用于 AI 生成歌词 |
| `XIAOYUN_AI_KEY` | 空 | 对应接口的 API Key |
| `XIAOYUN_AI_MODEL` | `gpt-4o-mini` | 生成歌词使用的模型 |

未配置 `XIAOYUN_AI_BASE_URL` 时，AI 生成入口会返回 `ai_not_configured`，其余功能不受影响。

---

## 构建与发布

```bash
cd web && npm run build        # 类型检查 + 前端构建到 web/dist
cd desktop && npm run dist     # 当前平台安装包
cd desktop && npm run dist:linux
cd desktop && npm run dist:win
cd desktop && npm run dist:mac
cd web && npm run android:apk  # Android Release APK
```

`.github/workflows/build.yml` 会在推送 `v*` 标签时并行构建 Windows、macOS、Linux 与 Android 产物，并自动创建 GitHub Release。Android 签名可通过 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD` 四个 Secret 注入；未配置时使用临时调试签名。

---

## 数据与隐私

- 所有数据保存在你自己部署的服务器或设备本地，项目不包含任何统计、埋点或遥测。
- 哔哩哔哩登录态仅保存在服务端数据库中，前端只读取必要的账号展示信息，不接触 Cookie 原文。
- 密码使用 bcrypt 哈希存储；会话使用 JWT。
- 退出登录或清理缓存不会误删曲库音频，音频文件的清理需要显式操作。

---

## 免责声明

- 本项目仅用于个人学习、研究与自建曲库管理，不提供任何音视频内容。
- 哔哩哔哩相关能力基于其公开 Web 接口实现，请遵守哔哩哔哩用户协议与相关法律法规，不要用于批量抓取、二次分发或任何商业用途。
- 通过本项目下载的内容版权归原作者与平台所有，请自行确认使用范围。
- 使用本项目产生的任何后果由使用者自行承担。

---

## 致谢

小云畅听在交互与技术方案上参考了以下开源项目，感谢作者们的分享：

| 项目 | 在本项目中的参考点 |
| --- | --- |
| [downkyicore](https://github.com/crazysmile-PhD/downkyicore) | 哔哩哔哩扫码登录、收藏夹解析、音轨选择与下载流程 |
| [lrc-maker](https://github.com/magic-akari/lrc-maker) | 歌词编辑器的交互组织与 LRC 时间轴规范 |
| [StatusBarLyric](https://github.com/Block-Network/StatusBarLyric) | 桌面歌词浮层的呈现方式与逐行高亮思路 |
| [lrclib.net](https://lrclib.net) | 在线歌词检索数据源 |
| [猫啃珠圆体](https://www.fonts.net.cn/font-42220289791.html) | 界面中文字体 |

以上条目同样展示在应用内的「设置 - 关于与致谢」页面。如果某个引用遗漏或标注有误，欢迎提交 Issue 或 Pull Request 更正。

---

## 字体许可

界面中文字体为 **猫啃珠圆体（MaokenZhuyuanTi）**，遵循 **SIL Open Font License 1.1**。

- 字体文件：`web/public/fonts/MaokenZhuyuanTi-Regular.ttf`
- 版权：`2022-2023 LongZhuTi Project Authors`、`2020 The RocknRoll Project Authors`
- 许可全文：<https://scripts.sil.org/OFL>

英文字形优先使用系统 `Comic Sans MS`，其余语言按 `--font-cute` 变量依次回退到圆润字体。字体文件本身不适用下文的 MIT 许可。

---

## 许可证

代码以 [MIT License](LICENSE) 发布，Copyright (c) 2026 小云屋。

欢迎 Issue 与 Pull Request。提交前请确保 `cd web && npm run typecheck` 与 `npm run build` 均通过。
