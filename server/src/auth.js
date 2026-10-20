import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config.js";
import { get } from "./db.js";

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function signToken(user) {
  return jwt.sign(
    { uid: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const queryToken = req.query?.token;
  return typeof queryToken === "string" && queryToken ? queryToken : null;
}

export function authRequired(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

export function publicUser(user) {
  const settings = get(
    "SELECT active_theme, preferences FROM user_settings WHERE user_id = ?",
    [user.id],
  );
  return {
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
    activeTheme: settings?.active_theme ?? "blueberry",
    preferences: settings ? safeParse(settings.preferences) : {},
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
