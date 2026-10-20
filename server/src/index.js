import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { CORS_ORIGINS, COVER_CACHE_DIR, HOST, MEDIA_DIR, PORT, WEB_DIST } from "./config.js";
import { HttpError } from "./http.js";
import authRouter from "./routes/auth.js";
import bilibiliRouter from "./routes/bilibili.js";
import cacheRouter from "./routes/cache.js";
import catalogRouter from "./routes/catalog.js";
import lyricsRouter from "./routes/lyrics.js";
import playlistRouter from "./routes/playlists.js";
import syncRouter from "./routes/sync.js";
import themeRouter from "./routes/themes.js";
import { ensureDemoAudio } from "./sources/demoAudio.js";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed =
    CORS_ORIGINS.includes("*") || (origin && CORS_ORIGINS.includes(origin));
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", CORS_ORIGINS.includes("*") ? "*" : origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "cloudmusic",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/playlists", playlistRouter);
app.use("/api", bilibiliRouter);
app.use("/api", lyricsRouter);
app.use("/api", cacheRouter);
app.use("/api", catalogRouter);
app.use("/api", themeRouter);
app.use("/api", syncRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

const indexHtml = path.join(WEB_DIST, "index.html");

app.use("/covers", express.static(COVER_CACHE_DIR, { index: false, maxAge: "7d" }));

if (fs.existsSync(indexHtml)) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(indexHtml);
  });
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: `upload_${error.code.toLowerCase()}` });
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.code : "internal_error";
  if (status >= 500) console.error("[server]", error);
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, HOST, () => {
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : PORT;
  const generated = ensureDemoAudio(MEDIA_DIR);
  console.log(`小云畅听 API listening on http://${HOST}:${actualPort}`);
  console.log(`XIAOYUN_READY ${actualPort}`);
  if (generated > 0) console.log(`[demo] generated ${generated} offline audio track(s)`);
  if (!fs.existsSync(indexHtml)) {
    console.log(`[web] dist not found at ${WEB_DIST} — run "npm run build" in web/`);
  }
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, shutdown);
}
process.on("message", (message) => {
  if (message === "shutdown") shutdown();
});
