const { app, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { APP_ORIGIN, registerScheme, serveWeb, createWindow } = require("./app-core");

registerScheme();

const outFile = process.env.XIAOYUN_SMOKE_OUT || path.join(__dirname, "smoke-report.json");
const shotFile = process.env.XIAOYUN_SMOKE_SHOT || "";
const logFile = outFile.replace(/\.json$/, ".log");
try {
  fs.writeFileSync(logFile, "");
} catch {}

function log(step, value) {
  const line = `[smoke] ${step} ${JSON.stringify(value ?? null)}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, `${line}\n`);
  } catch {}
}

async function run(win) {
  const report = {};
  const errors = [];
  win.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) errors.push(message);
  });

  await win.loadURL(APP_ORIGIN);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const run1 = await win.webContents.executeJavaScript(
    `(async () => {
      const rail = document.querySelector(".rail");
      const info = {
        protocol: location.protocol,
        title: document.title,
        rail: Boolean(rail),
        navItems: Array.from(document.querySelectorAll(".rail__nav .navlink")).map((n) => n.textContent.trim()),
        passwordInputs: document.querySelectorAll("input[type=password]").length,
        dbs: (await indexedDB.databases()).map((d) => d.name),
      };
      return info;
    })()`,
    true
  );
  report.window = run1;
  log("window", run1);

  const playlistCount = await win.webContents.executeJavaScript(
    `(async () => {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("xiaoyun-local");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const rows = await new Promise((resolve) => {
        const tx = db.transaction("playlists", "readonly");
        const all = tx.objectStore("playlists").getAll();
        all.onsuccess = () => resolve(all.result);
      });
      await new Promise((resolve) => {
        const tx = db.transaction("playlists", "readwrite");
        const add = tx.objectStore("playlists").put({
          id: 9001,
          name: "冒烟歌单",
          description: "",
          trackIds: [],
          trackCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        add.onsuccess = () => tx.oncomplete = resolve;
        add.onerror = () => tx.oncomplete = resolve;
      });
      return rows.length;
    })()`,
    true
  );
  report.playlistsBeforeWrite = playlistCount;

  const afterWrite = await win.webContents.executeJavaScript(
    `(async () => {
      const db = await new Promise((resolve) => {
        const req = indexedDB.open("xiaoyun-local");
        req.onsuccess = () => resolve(req.result);
      });
      const rows = await new Promise((resolve) => {
        const tx = db.transaction("playlists", "readonly");
        const all = tx.objectStore("playlists").getAll();
        all.onsuccess = () => resolve(all.result);
      });
      return rows.map((r) => ({ id: r.id, name: r.name }));
    })()`,
    true
  );
  report.playlistsAfterWrite = afterWrite;

  const probe = await win.webContents.executeJavaScript(
    `fetch("${APP_ORIGIN}manifest.webmanifest").then((r) => ({ status: r.status })).catch(() => ({ status: -1 }))`,
    true
  );
  report.manifest = probe;

  const missing = await win.webContents.executeJavaScript(
    `fetch("${APP_ORIGIN}definitely-missing.png").then((r) => r.status).catch(() => -1)`,
    true
  );
  report.missingAsset = missing;

  report.errors = errors;
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (shotFile) {
    const image = await win.webContents.capturePage();
    fs.writeFileSync(shotFile, image.toPNG());
  }

  app.quit();
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const root = serveWeb(app);
  if (!fs.existsSync(path.join(root, "index.html"))) {
    console.error("[smoke] missing web dist", root);
    app.quit();
    return;
  }
  const win = createWindow({ title: "smoke", onClosed: () => {} });
  try {
    await run(win);
  } catch (error) {
    console.error("[smoke] failed", error);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
