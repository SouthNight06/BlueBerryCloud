const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const READY_PATTERN = /XIAOYUN_READY\s+(\d+)/;
const REMOTE_BASE = (process.env.XIAOYUN_REMOTE_BASE || "https://music.lichenlc.cn").replace(
  /\/+$/,
  "",
);
const FORCE_LOCAL = process.env.XIAOYUN_DESKTOP_LOCAL === "1";
let serverPort = 0;
let serverProcess = null;
let mainWindow = null;
let appUrl = "";
let appOrigin = "";
let quitting = false;

function serverDir() {
  if (app.isPackaged) return path.join(process.resourcesPath, "server");
  const built = path.resolve(__dirname, "server-dist");
  if (fs.existsSync(path.join(built, "index.cjs"))) return built;
  return path.resolve(__dirname, "..", "server");
}

function serverEntry(dir) {
  const bundled = path.join(dir, "index.cjs");
  return fs.existsSync(bundled) ? bundled : path.join(dir, "src", "index.js");
}

function webDistDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.resolve(__dirname, "..", "web", "dist");
}

function startServer() {
  return new Promise((resolve, reject) => {
    const dir = serverDir();
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
        XIAOYUN_WEB_DIST: webDistDir(),
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

function createWindow(url, origin) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "小云畅听",
    backgroundColor: "#f3f6fd",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, next) => {
    if (next.startsWith(origin)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(next)) shell.openExternal(next);
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow.loadURL(url);
}

async function remoteReady() {
  if (FORCE_LOCAL) return false;
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
      if (await remoteReady()) {
        appUrl = `${REMOTE_BASE}/`;
        appOrigin = appUrl;
      } else {
        serverPort = await startServer();
        appUrl = `http://127.0.0.1:${serverPort}/`;
        appOrigin = appUrl;
      }
      await createWindow(appUrl, appOrigin);
    } catch (error) {
      dialog.showErrorBox(
        "小云畅听 启动失败",
        String((error && error.message) || error)
      );
      app.quit();
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && appUrl) {
        createWindow(appUrl, appOrigin);
      }
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
