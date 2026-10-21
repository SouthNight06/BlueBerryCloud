const { app, Menu, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { APP_ORIGIN, registerScheme, serveWeb, createWindow } = require("./app-core");

registerScheme();

let mainWindow = null;
let ready = false;

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
      const root = serveWeb(app);
      if (!fs.existsSync(path.join(root, "index.html"))) {
        throw new Error(`找不到前端产物：${path.join(root, "index.html")}`);
      }
      mainWindow = createWindow({
        title: "小云畅听 · 本地版",
        onClosed: () => {
          mainWindow = null;
        },
      });
      await mainWindow.loadURL(APP_ORIGIN);
      ready = true;
    } catch (error) {
      dialog.showErrorBox("小云畅听 启动失败", String((error && error.message) || error));
      app.quit();
    }

    app.on("activate", () => {
      if (ready && !mainWindow) {
        mainWindow = createWindow({
          title: "小云畅听 · 本地版",
          onClosed: () => {
            mainWindow = null;
          },
        });
        void mainWindow.loadURL(APP_ORIGIN);
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
