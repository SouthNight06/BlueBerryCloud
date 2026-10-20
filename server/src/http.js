export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (code) => new HttpError(400, code);
export const notFound = (code) => new HttpError(404, code);

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function str(value, { field, max = 300, required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw badRequest(`${field}_required`);
    return "";
  }
  if (typeof value !== "string") throw badRequest(`${field}_must_be_string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${field}_required`);
  return trimmed.slice(0, max);
}

export function int(value, { field, min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${field}_invalid`);
  }
  return parsed;
}

export function optionalInt(value, options) {
  if (value === undefined || value === null || value === "") return null;
  return int(value, options);
}

export function bool(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function sanitizeFilename(name, fallback = "audio") {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 120);
}
