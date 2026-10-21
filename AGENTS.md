# 小云畅听 · 项目指令

本文件在选中该工作区时自动加载。项目路径：本地 `D:\DSH WorkSpace\aurora-music`，服务器 `/opt/cloudmusic`。

## 项目定位

小云畅听（英文名 **CloudMusic**）是一个个人云音乐播放器：自建服务端存歌，Web / 安卓 / Windows / macOS / Linux 五端共用一套前端。

- Web：React 18 + Vite + TypeScript，Capacitor 打包安卓
- Server：Express + `node:sqlite`（Node 内置，**不要**引入 better-sqlite3）
- Desktop：Electron

## 目录

```
web/     前端 + Capacitor（android/ 在 web/android）
server/  API 与静态托管
desktop/ Electron 壳
```

## 常用命令

本机 shell 是 Windows PowerShell 5.1：**不支持 `&&`**，一行里的多个命令要分开写；路径用反斜杠或引号包起来。

```powershell
# 前端依赖 + 构建（构建带 typecheck，红了就停）
cd D:\DSH WorkSpace\aurora-music\web
npm ci
npm run build

# 只查类型
npx tsc --noEmit

# 本地 API（默认 3001）
cd D:\DSH WorkSpace\aurora-music\server
npm ci
npm start
```

`npm run dev` 起 Vite（5173），`/api` 与 `/media` 已代理到 `127.0.0.1:3001`，本地联调不用改地址。CI 构建时会注入 `VITE_API_BASE`（见 `deploy-server.yml`），所以**线上产物与本地 build 的 hash 天然不同**，属正常。

## 代码风格

- 不要加注释，除非逻辑确实反直觉；能靠命名说清的就别写注释。
- 不要新增依赖来解决已有依赖能解决的问题；引入库之前先看 `package.json` 与相邻文件的写法。
- 不写 `console.log` 调试残留，出错走已有的 toast / 日志通道。

## 硬性规范

### 品牌

中文「小云畅听」，英文 **CloudMusic**。代码、包名、产物名里不要出现 `xiaoyunchangting`。

### DJ 模式

- 指元素被**压扁再弹起**的**上下**弹跳，不是左右晃。
- 必须跟随节拍（`waveBus`），不能纯随机。
- 强度由设置里的滑块控制。
- 系统开启「减少动态效果」时不要整段关掉：DJ 照常跟随节拍，只把其余过渡压到 42 ms。

### 音频播放

- `<audio>` 必须带 `crossOrigin="anonymous"`。
- `AudioContext` 处于 `suspended` 时不要创建 `MediaElementSource`（会把元素直接静音），先 `resume()` 确认 `running` 再建音频图。
- 服务端 `/media` 静态目录必须挂载；CORS 要放行 `Range` / `If-Range`，`Access-Control-Expose-Headers` 要含 `Content-Length` / `Content-Range` / `Accept-Ranges`。
- Capacitor `androidScheme: "https"`，App origin 是 `https://localhost`，与 API 必然跨源，别假设同源。

### 安全

README、Release、commit、代码、截图里**不得出现**服务器 IP 与密码。凭据类文件一律不进仓库（`.trae/` 已在 `.gitignore`）。

## 发版

版本号要同步改 8 处（三个 `package.json` + 三个 `package-lock.json` + `web/android/app/build.gradle` 的 `versionCode`/`versionName` + `web/src/screens/SettingsView.tsx` 的 `VERSION`），再更新 README 的版本段落。

```powershell
git commit -m "chore(release): vX.Y.Z"
git push origin main
git tag -a vX.Y.Z -m "小云畅听 vX.Y.Z"
git push origin vX.Y.Z
git push origin main:deploy        # 触发服务器部署
```

打 tag 后**必须**补写中文 Release 说明（本机没有 `gh`，用 GitHub API 或网页补）。

`deploy` 分支只是触发器，代码始终以 `main` 为准。

## 服务器

凭据、拓扑、禁改站点清单在全局 `$DSH_HOME/AGENTS.md` 里，动手前先读；服务器密码走 `$env:DSH_CLOUDMUSIC_VPS_PASSWORD`（由 `cloudmusic-ops` 插件注入），**不要**把明文写进任何文件。详细操作见 `cloudmusic-server-ops` 技能，发版流程见 `cloudmusic-release` 技能。
