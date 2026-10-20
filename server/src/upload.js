import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { MAX_UPLOAD_BYTES, MEDIA_DIR, UPLOAD_DIR } from "./config.js";
import { HttpError } from "./http.js";

const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".flac",
  ".wav",
  ".ogg",
  ".m4a",
  ".aac",
  ".opus",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, done) => done(null, UPLOAD_DIR),
  filename: (_req, file, done) => {
    const ext = path.extname(file.originalname).toLowerCase();
    done(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

export const audioUpload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, done) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      done(new HttpError(415, "unsupported_audio_format"));
      return;
    }
    done(null, true);
  },
}).single("file");

export function resolveUploadPath(filePath) {
  if (!filePath) return null;
  const absolute = path.resolve(UPLOAD_DIR, path.basename(filePath));
  if (!absolute.startsWith(path.resolve(UPLOAD_DIR))) return null;
  return absolute;
}

export function resolveMediaPath(streamUrl) {
  if (typeof streamUrl !== "string" || !streamUrl.startsWith("/media/")) return null;
  const absolute = path.resolve(MEDIA_DIR, streamUrl.slice("/media/".length));
  if (!absolute.startsWith(path.resolve(MEDIA_DIR))) return null;
  return absolute;
}
