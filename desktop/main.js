const { app, Menu, dialog, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const core = require("./app-core");

const READY_PATTERN = /XIAOYUN_READY\s+(\d+)/;
const REMOTE_BASE = (process.env.XIAOYUN_REMOTE_BASE || "https://music.lichenlc.cn").replace(
  /\/+$/,
  "",
);
const FORCE_LOCAL_SERVER = process.env.XIAOYUN_DESKTOP_LOCAL === "1";

let mainWindow = null;
let serverProcess = null;
let appUrl = "";
let appOrigin = "";
let quitting = false;

function bundledServerDir() {
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, "server");
    return fs.existsSync(path.join(dir, "index.cjs")) ? dir : null;
  }
  const built = path.resolve(__dirname, "server-dist");
  if (fs.existsSync(path.join(built, "index.cjs"))) return built;
  const dev = path.resolve(__dirname, "..", "server");
  return fs.existsSync(path.join(dev, "src", "index.js")) ? dev : null;
}

const serverDir = process.env.XIAOYUN_OFFLINE === "1" ? null : bundledServerDir();
const OFFLINE = !serverDir;

if (OFFLINE) core.registerScheme();

function serverEntry(dir) {
  const bundled = path.join(dir, "index.cjs");
  return fs.existsSync(bundled) ? bundled : path.join(dir, "src", "index.js");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const dir = serverDir;
    const entry = serverEntry(dir);
    if (!fs.existsSync(entry)) {
      reject(new Error(`找不到服务端入口：${entry}`));
      return;
    }

    const dataRoot = path.join(app.getPath("userData"), "library");
    fs.mkdirSync(dataRoot, { recursive: true });

    const child = spawn(process.execPath, [entry], {
      cwd: dir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        PORT: "0",
        HOST: "127.0.0.1",
        XIAOYUN_DATA_DIR: dataRoot,
        XIAOYUN_WEB_DIST: core.webDistDir(app),
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    serverProcess = child;
    let settled = false;
    let buffer = "";

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("本地服务启动超时（20 秒）"));
    }, 20000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) console.log("[server]", line);
        const ready = READY_PATTERN.exec(line);
        if (ready && !settled) {
          settled = true;
          clearTimeout(timer);
          resolve(Number(ready[1]));
        }
        index = buffer.indexOf("\n");
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("exit", (code) => {
      serverProcess = null;
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`本地服务已退出（code ${code}）`));
        return;
      }
      if (!quitting && mainWindow) {
        dialog.showErrorBox("小云畅听", "本地服务意外停止，应用即将关闭。");
        app.quit();
      }
    });
  });
}

async function remoteReady() {
  if (FORCE_LOCAL_SERVER) return false;
  try {
    const response = await fetch(`${REMOTE_BASE}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return Boolean(data && data.ok);
  } catch {
    return false;
  }
}

async function resolveTarget() {
  if (OFFLINE) {
    const root = core.serveWeb(app);
    const indexFile = path.join(root, "index.html");
    if (!fs.existsSync(indexFile)) {
      throw new Error(`找不到前端产物：${indexFile}`);
    }
    appUrl = core.APP_ORIGIN;
    appOrigin = core.APP_ORIGIN;
    return;
  }

  if (await remoteReady()) {
    appUrl = `${REMOTE_BASE}/`;
    appOrigin = appUrl;
    return;
  }

  const port = await startServer();
  appUrl = `http://127.0.0.1:${port}/`;
  appOrigin = appUrl;
}

function openWindow() {
  mainWindow = core.createWindow({
    title: OFFLINE ? "小云畅听 · 本地版" : "小云畅听",
    origin: appOrigin,
    onClosed: () => {
      mainWindow = null;
    },
  });
  return mainWindow.loadURL(appUrl);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    try {
      await resolveTarget();
      await openWindow();
    } catch (error) {
      dialog.showErrorBox("小云畅听 启动失败", String((error && error.message) || error));
      app.quit();
    }

    app.on("activate", () => {
      if (appUrl && BrowserWindow.getAllWindows().length === 0) void openWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    quitting = true;
    if (serverProcess) {
      serverProcess.kill("SIGTERM");
      serverProcess = null;
    }
  });
}
