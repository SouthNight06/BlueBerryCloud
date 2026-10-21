const { BrowserWindow, shell, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SCHEME = "xiaoyun";
const APP_ORIGIN = `${SCHEME}://app/`;

function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function webDistDir(app) {
  return app.isPackaged
    ? path.join(process.resourcesPath, "web")
    : path.resolve(__dirname, "..", "web", "dist");
}

function resolveAsset(root, requestUrl) {
  let rel = "/";
  try {
    rel = decodeURIComponent(new URL(requestUrl).pathname);
  } catch {
    rel = "/";
  }
  if (!rel || rel === "/") rel = "/index.html";
  const base = path.resolve(root);
  const file = path.resolve(base, `.${rel}`);
  if (file !== base && !file.startsWith(`${base}${path.sep}`)) return null;
  if (!fs.existsSync(file)) return null;
  if (!fs.statSync(file).isFile()) return null;
  return file;
}

function serveWeb(app) {
  const root = webDistDir(app);
  protocol.handle(SCHEME, async (request) => {
    const file = resolveAsset(root, request.url);
    if (file) return net.fetch(pathToFileURL(file).toString());
    let hasExt = true;
    try {
      hasExt = Boolean(path.extname(new URL(request.url).pathname));
    } catch {
      hasExt = true;
    }
    if (hasExt) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(path.join(root, "index.html")).toString());
  });
  return root;
}

function createWindow({ title, onClosed }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title,
    backgroundColor: "#f3f6fd",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, next) => {
    if (next.startsWith(APP_ORIGIN)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(next)) shell.openExternal(next);
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => onClosed?.());

  return win;
}

module.exports = { SCHEME, APP_ORIGIN, registerScheme, serveWeb, createWindow, webDistDir };
