import { Router } from "express";
import { authRequired, hashPassword, publicUser, signToken, verifyPassword } from "../auth.js";
import { get, run } from "../db.js";
import { asyncHandler, HttpError, str } from "../http.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_.\-\u4e00-\u9fa5]{3,32}$/;

const router = Router();

function readCredentials(body) {
  const username = str(body?.username, { field: "username", max: 32, required: true });
  const password = str(body?.password, { field: "password", max: 128, required: true });
  return { username, password };
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { username, password } = readCredentials(req.body);
    if (!USERNAME_PATTERN.test(username)) throw new HttpError(400, "username_invalid");
    if (password.length < 6) throw new HttpError(400, "password_too_short");

    if (get("SELECT id FROM users WHERE username = ?", [username])) {
      throw new HttpError(409, "username_taken");
    }

    const { lastInsertRowid } = run(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, hashPassword(password)],
    );
    run("INSERT INTO user_settings (user_id) VALUES (?)", [lastInsertRowid]);

    const user = get("SELECT * FROM users WHERE id = ?", [lastInsertRowid]);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = readCredentials(req.body);
    const user = get("SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new HttpError(401, "invalid_credentials");
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get(
  "/me",
  authRequired,
  asyncHandler(async (req, res) => {
    const user = get("SELECT * FROM users WHERE id = ?", [req.user.uid]);
    if (!user) throw new HttpError(401, "user_not_found");
    res.json({ user: publicUser(user) });
  }),
);

export default router;
