import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { authRequired } from "../auth.js";
import { UPLOAD_DIR } from "../config.js";
import { all, get } from "../db.js";
import { asyncHandler, badRequest, str } from "../http.js";
import { clearCoverCache, coverCacheStats } from "../bilibili/cover.js";

const router = Router();

function uploadFiles() {
  return fs
    .readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

function referencedFiles(userId) {
  const rows = all(
    "SELECT file_path FROM tracks WHERE owner_id = ? AND file_path IS NOT NULL",
    [userId],
  );
  return new Set(rows.map((row) => path.basename(row.file_path)));
}

function orphanFiles(userId) {
  const referenced = referencedFiles(userId);
  return uploadFiles().filter((name) => !referenced.has(name));
}

function stats(userId) {
  const covers = coverCacheStats();
  const owned = all(
    "SELECT file_path FROM tracks WHERE owner_id = ? AND file_path IS NOT NULL",
    [userId],
  ).map((row) => path.basename(row.file_path));

  let audioBytes = 0;
  for (const name of owned) {
    try {
      audioBytes += fs.statSync(path.join(UPLOAD_DIR, name)).size;
    } catch {
      /* 文件缺失时忽略 */
    }
  }

  const orphans = orphanFiles(userId);
  let orphanBytes = 0;
  for (const name of orphans) {
    try {
      orphanBytes += fs.statSync(path.join(UPLOAD_DIR, name)).size;
    } catch {
      /* ignore */
    }
  }

  return {
    covers: { files: covers.files, bytes: covers.bytes },
    audio: { files: owned.length, bytes: audioBytes },
    orphans: { files: orphans.length, bytes: orphanBytes },
  };
}

router.get(
  "/cache",
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ cache: stats(req.user.uid) });
  }),
);

router.post(
  "/cache/clear",
  authRequired,
  asyncHandler(async (req, res) => {
    const target = str(req.body?.target, { field: "target", max: 20 }) || "covers";
    if (!["covers", "orphans", "all"].includes(target)) {
      throw badRequest("target_invalid");
    }

    let removed = 0;
    if (target === "covers" || target === "all") {
      removed += clearCoverCache();
    }
    if (target === "orphans" || target === "all") {
      const referenced = referencedFiles(req.user.uid);
      for (const name of uploadFiles()) {
        if (referenced.has(name)) continue;
        const track = get("SELECT id FROM tracks WHERE file_path LIKE ?", [`%${name}`]);
        if (track) continue;
        fs.rmSync(path.join(UPLOAD_DIR, name), { force: true });
        removed += 1;
      }
    }

    res.json({ removed, cache: stats(req.user.uid) });
  }),
);

export default router;
