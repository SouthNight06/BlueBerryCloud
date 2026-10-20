import { Router } from "express";
import QRCode from "qrcode";
import { authRequired } from "../auth.js";
import {
  BiliError,
  createQrLogin,
  fetchNav,
  fetchVideo,
  listFavFolders,
  listFavItems,
  pollQrLogin,
} from "../bilibili/client.js";
import {
  getAccount,
  publicAccount,
  removeAccount,
  saveAccount,
} from "../bilibili/account.js";
import { asyncHandler, badRequest, HttpError, optionalInt, str } from "../http.js";
import { toTrack } from "../serializers.js";
import { bilibiliSource, parseSourceId } from "../sources/bilibili.js";
import { discardFile, findBySource, insertPrepared } from "../tracks.js";

const router = Router();

const POLL_STATES = {
  0: "ok",
  86090: "scanned",
  86101: "waiting",
  86038: "expired",
};

function requireAccount(userId) {
  const account = getAccount(userId);
  if (!account) throw new HttpError(401, "bilibili_login_required");
  return account;
}

function wrap(error) {
  if (error instanceof BiliError) return new HttpError(error.status, error.code);
  return new HttpError(502, `bilibili_failed:${error?.message ?? "unknown"}`);
}

router.get(
  "/bilibili/qr",
  authRequired,
  asyncHandler(async (_req, res) => {
    let login;
    try {
      login = await createQrLogin();
    } catch (error) {
      throw wrap(error);
    }
    const svg = await QRCode.toString(login.url, {
      type: "svg",
      margin: 1,
      width: 240,
      color: { dark: "#182033", light: "#ffffff" },
    });
    res.json({ key: login.key, url: login.url, svg });
  }),
);

router.get(
  "/bilibili/qr/poll",
  authRequired,
  asyncHandler(async (req, res) => {
    const key = str(req.query.key, { field: "key", max: 120, required: true });
    let result;
    try {
      result = await pollQrLogin(key);
    } catch (error) {
      throw wrap(error);
    }

    const state = POLL_STATES[result.code] ?? "unknown";
    if (state !== "ok") {
      res.json({ state, code: result.code, message: result.message, account: null });
      return;
    }

    const sessdata = result.raw.SESSDATA ?? "";
    if (!sessdata) throw new HttpError(502, "bilibili_cookie_missing");

    const cookie = result.cookie;
    let nav;
    try {
      nav = await fetchNav(cookie);
    } catch (error) {
      throw wrap(error);
    }

    saveAccount(req.user.uid, {
      sessdata,
      biliJct: result.raw.bili_jct ?? "",
      mid: nav.mid || result.raw.DedeUserID || "",
      uname: nav.uname,
      face: nav.face,
      vip: nav.vip,
    });

    res.json({
      state: "ok",
      code: 0,
      message: "",
      account: publicAccount(getAccount(req.user.uid)),
    });
  }),
);

router.get(
  "/bilibili/account",
  authRequired,
  asyncHandler(async (req, res) => {
    const stored = getAccount(req.user.uid);
    if (!stored) {
      res.json({ account: null });
      return;
    }

    try {
      const nav = await fetchNav(stored.cookie);
      saveAccount(req.user.uid, {
        sessdata: stored.sessdata,
        biliJct: stored.biliJct,
        mid: nav.mid,
        uname: nav.uname,
        face: nav.face,
        vip: nav.vip,
      });
      res.json({ account: publicAccount(getAccount(req.user.uid)) });
    } catch (error) {
      if (error instanceof BiliError && error.status === 401) {
        removeAccount(req.user.uid);
        res.json({ account: null, expired: true });
        return;
      }
      res.json({ account: publicAccount(stored) });
    }
  }),
);

router.delete(
  "/bilibili/account",
  authRequired,
  asyncHandler(async (req, res) => {
    removeAccount(req.user.uid);
    res.json({ removed: true });
  }),
);

router.get(
  "/bilibili/folders",
  authRequired,
  asyncHandler(async (req, res) => {
    const account = requireAccount(req.user.uid);
    let folders;
    try {
      folders = await listFavFolders(account.cookie, account.mid);
    } catch (error) {
      throw wrap(error);
    }
    res.json({ folders });
  }),
);

router.get(
  "/bilibili/folders/:id/items",
  authRequired,
  asyncHandler(async (req, res) => {
    const account = requireAccount(req.user.uid);
    const mediaId = optionalInt(req.params.id, { field: "id", min: 1 });
    if (!mediaId) throw badRequest("id_invalid");
    const page = optionalInt(req.query.page, { field: "page", min: 1, max: 200 }) ?? 1;
    const pageSize =
      optionalInt(req.query.pageSize, { field: "pageSize", min: 1, max: 50 }) ?? 20;

    let payload;
    try {
      payload = await listFavItems(account.cookie, mediaId, page, pageSize);
    } catch (error) {
      throw wrap(error);
    }
    res.json({ ...payload, page, pageSize });
  }),
);

router.get(
  "/bilibili/video/:bvid",
  authRequired,
  asyncHandler(async (req, res) => {
    const { bvid } = parseSourceId(req.params.bvid);
    let video;
    try {
      video = await fetchVideo(bvid);
    } catch (error) {
      throw wrap(error);
    }
    res.json({ video });
  }),
);

router.post(
  "/bilibili/download",
  authRequired,
  asyncHandler(async (req, res) => {
    const bvid = str(req.body?.bvid, { field: "bvid", max: 20, required: true });
    const cid = optionalInt(req.body?.cid, { field: "cid", min: 1 });
    const requestedId = cid ? `${bvid}:${cid}` : bvid;

    const existing = findBySource(req.user.uid, bilibiliSource.id, requestedId);
    if (existing) {
      res.json({ track: toTrack(existing), duplicated: true });
      return;
    }

    let prepared;
    try {
      prepared = await bilibiliSource.ingest(requestedId, { userId: req.user.uid });
    } catch (error) {
      throw wrap(error);
    }

    const clash =
      prepared.sourceId && prepared.sourceId !== requestedId
        ? findBySource(req.user.uid, bilibiliSource.id, prepared.sourceId)
        : null;
    if (clash) {
      discardFile(prepared.filePath);
      res.json({ track: toTrack(clash), duplicated: true });
      return;
    }

    const row = insertPrepared(req.user.uid, bilibiliSource.id, prepared);
    res.status(201).json({ track: toTrack(row), duplicated: false });
  }),
);

export default router;
