import { get, run } from "../db.js";

export function getAccount(userId) {
  const row = get("SELECT * FROM bili_accounts WHERE user_id = ?", [userId]);
  if (!row) return null;
  const cookie = [
    `SESSDATA=${row.sessdata}`,
    row.bili_jct ? `bili_jct=${row.bili_jct}` : "",
    row.dedeuserid ? `DedeUserID=${row.dedeuserid}` : "",
  ]
    .filter(Boolean)
    .join("; ");
  return {
    userId: row.user_id,
    mid: row.dedeuserid,
    sessdata: row.sessdata,
    biliJct: row.bili_jct,
    uname: row.uname,
    face: row.face ?? null,
    vip: Boolean(row.vip),
    cookie,
    updatedAt: row.updated_at,
  };
}

export function saveAccount(userId, account) {
  run(
    `INSERT INTO bili_accounts (user_id, sessdata, bili_jct, dedeuserid, uname, face, vip, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       sessdata = excluded.sessdata,
       bili_jct = excluded.bili_jct,
       dedeuserid = excluded.dedeuserid,
       uname = excluded.uname,
       face = excluded.face,
       vip = excluded.vip,
       updated_at = excluded.updated_at`,
    [
      userId,
      account.sessdata,
      account.biliJct ?? "",
      account.mid ?? "",
      account.uname ?? "",
      account.face ?? null,
      account.vip ? 1 : 0,
    ],
  );
}

export function removeAccount(userId) {
  run("DELETE FROM bili_accounts WHERE user_id = ?", [userId]);
}

export function publicAccount(account) {
  if (!account) return null;
  return {
    mid: account.mid,
    uname: account.uname,
    face: account.face,
    vip: account.vip,
    updatedAt: account.updatedAt,
  };
}
