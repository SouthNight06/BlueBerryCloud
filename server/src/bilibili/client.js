import crypto from "node:crypto";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REFERER = "https://www.bilibili.com/";

const MIXIN_KEY_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

export class BiliError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "BiliError";
    this.code = code;
    this.status = status;
  }
}

async function biliFetch(url, { cookie, timeout = 15_000, headers = {} } = {}) {
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: REFERER,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9",
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
}

async function biliJson(url, options) {
  let response;
  try {
    response = await biliFetch(url, options);
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new BiliError("bili_timeout", "连接哔哩哔哩超时，请稍后再试");
    }
    throw new BiliError("bili_unreachable", "无法连接哔哩哔哩，请检查网络");
  }
  if (!response.ok) {
    throw new BiliError("bili_http_error", `哔哩哔哩接口返回 ${response.status}`);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new BiliError("bili_bad_response", "哔哩哔哩返回了无法解析的数据");
  }
  if (!payload || typeof payload.code !== "number") {
    throw new BiliError("bili_bad_response", "哔哩哔哩返回了无法解析的数据");
  }
  if (payload.code !== 0) {
    throw new BiliError(`bili_${payload.code}`, payload.message || "哔哩哔哩接口报错");
  }
  return payload.data;
}

let wbiCache = { at: 0, img: "", sub: "" };

function keyOf(url) {
  return String(url || "")
    .split("/")
    .pop()
    .split(".")[0];
}

async function wbiKeys() {
  if (wbiCache.img && Date.now() - wbiCache.at < 6 * 3_600_000) return wbiCache;
  const data = await biliJson("https://api.bilibili.com/x/web-interface/nav");
  const img = keyOf(data?.wbi_img?.img_url);
  const sub = keyOf(data?.wbi_img?.sub_url);
  if (!img || !sub) throw new BiliError("bili_wbi_missing", "无法获取哔哩哔哩签名密钥");
  wbiCache = { at: Date.now(), img, sub };
  return wbiCache;
}

function encodeParam(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

async function signedQuery(params) {
  const { img, sub } = await wbiKeys();
  const raw = img + sub;
  const mixin = MIXIN_KEY_TAB.map((index) => raw[index] ?? "").join("").slice(0, 32);
  const stamped = { ...params, wts: Math.floor(Date.now() / 1000) };
  const query = Object.keys(stamped)
    .sort()
    .map((key) => `${encodeParam(key)}=${encodeParam(stamped[key])}`)
    .join("&");
  const rid = crypto.createHash("md5").update(query + mixin).digest("hex");
  return `${query}&w_rid=${rid}`;
}

let anonymousCookie = "";

async function anonymous() {
  if (anonymousCookie) return anonymousCookie;
  try {
    const data = await biliJson("https://api.bilibili.com/x/frontend/finger/spi");
    const buvid3 = data?.b_3 ?? "";
    if (buvid3) anonymousCookie = `buvid3=${buvid3}`;
  } catch {
    /* 搜索仍可尝试无 cookie 请求 */
  }
  return anonymousCookie;
}

export function normalizeImage(url) {
  if (!url) return null;
  let value = String(url).trim();
  if (value.startsWith("//")) value = `https:${value}`;
  if (value.startsWith("http://")) value = `https://${value.slice(7)}`;
  return value.startsWith("https://") ? value : null;
}

export function cookieFromJar(jar) {
  const parts = [];
  if (jar.SESSDATA) parts.push(`SESSDATA=${jar.SESSDATA}`);
  if (jar.bili_jct) parts.push(`bili_jct=${jar.bili_jct}`);
  if (jar.DedeUserID) parts.push(`DedeUserID=${jar.DedeUserID}`);
  return parts.join("; ");
}

function readSetCookies(response) {
  const jar = {};
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const line of list) {
    const [pair] = String(line).split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name) jar[name] = value;
  }
  return jar;
}

export async function createQrLogin() {
  const data = await biliJson(
    "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
  );
  if (!data?.qrcode_key || !data?.url) {
    throw new BiliError("bili_qr_failed", "无法生成哔哩哔哩登录二维码");
  }
  return { key: data.qrcode_key, url: data.url };
}

export async function pollQrLogin(key) {
  const response = await biliFetch(
    `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`,
  );
  const payload = await response.json().catch(() => null);
  const data = payload?.data ?? {};
  const cookies = readSetCookies(response);
  return {
    code: Number(data.code ?? -1),
    message: String(data.message ?? ""),
    cookie: cookieFromJar(cookies),
    raw: cookies,
  };
}

export async function fetchNav(cookie) {
  const data = await biliJson("https://api.bilibili.com/x/web-interface/nav", {
    cookie,
  });
  if (!data?.isLogin) {
    throw new BiliError("bili_login_expired", "哔哩哔哩登录状态已失效", 401);
  }
  return {
    mid: String(data.mid ?? ""),
    uname: String(data.uname ?? ""),
    face: normalizeImage(data.face),
    vip: Number(data.vipStatus ?? 0) > 0 || Number(data?.vip?.status ?? 0) === 1,
    level: Number(data?.level_info?.current_level ?? 0),
  };
}

function toFolder(item, collected) {
  return {
    id: Number(item.id ?? item.media_id ?? 0),
    title: String(item.title ?? "未命名收藏夹"),
    count: Number(item.media_count ?? item.count ?? 0),
    collected,
    cover: normalizeImage(item.cover),
  };
}

export async function listFavFolders(cookie, mid) {
  const [created, collected] = await Promise.allSettled([
    biliJson(
      `https://api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=${encodeURIComponent(mid)}&web_location=333.1387`,
      { cookie },
    ),
    biliJson(
      `https://api.bilibili.com/x/v3/fav/folder/collected/list?up_mid=${encodeURIComponent(mid)}&pn=1&ps=50&platform=web`,
      { cookie },
    ),
  ]);

  if (created.status !== "fulfilled" && collected.status !== "fulfilled") {
    throw new BiliError("bili_folder_failed", "无法读取哔哩哔哩收藏夹");
  }

  const folders = [];
  if (created.status === "fulfilled") {
    for (const item of created.value?.list ?? []) folders.push(toFolder(item, false));
  }
  if (collected.status === "fulfilled") {
    for (const item of collected.value?.list ?? []) folders.push(toFolder(item, true));
  }
  return folders.filter((folder) => folder.id > 0);
}

function toFavItem(item) {
  const duration = Number(item.duration ?? 0);
  return {
    bvid: String(item.bvid ?? ""),
    title: String(item.title ?? "未命名视频").trim(),
    cover: normalizeImage(item.cover),
    author: String(item?.upper?.name ?? ""),
    duration: Number.isFinite(duration) ? duration : 0,
    play: Number(item?.cnt_info?.play ?? 0) || null,
  };
}

export async function listFavItems(cookie, mediaId, page = 1, pageSize = 20) {
  const data = await biliJson(
    `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${encodeURIComponent(
      mediaId,
    )}&pn=${page}&ps=${pageSize}&platform=web&keyword=&order=mtime&type=0&tid=0`,
    { cookie },
  );
  const medias = (data?.medias ?? []).filter((item) => item.attr !== 1 && item.bvid);
  return {
    title: String(data?.info?.title ?? ""),
    total: Number(data?.info?.media_count ?? 0),
    hasMore: Boolean(data?.has_more),
    items: medias.map(toFavItem),
  };
}

export async function fetchVideo(bvid) {
  const data = await biliJson(
    `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
  );
  const pages = (data?.pages ?? []).map((page) => ({
    cid: Number(page.cid),
    title: String(page.part ?? `P${page.page}`),
    page: Number(page.page ?? 1),
    duration: Number(page.duration ?? 0),
  }));
  return {
    bvid: String(data?.bvid ?? bvid),
    title: String(data?.title ?? "未命名视频").trim(),
    cover: normalizeImage(data?.pic),
    author: String(data?.owner?.name ?? ""),
    duration: Number(data?.duration ?? 0),
    pages,
  };
}

export async function fetchAudioStream(cookie, bvid, cid) {
  const data = await biliJson(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(
      bvid,
    )}&cid=${encodeURIComponent(cid)}&fnval=16&fnver=0&fourk=1`,
    { cookie },
  );
  const audios = data?.dash?.audio ?? [];
  if (audios.length === 0) {
    throw new BiliError("bili_no_audio", "该内容没有可用的音频流");
  }
  const best = audios.reduce((left, right) =>
    Number(right.bandwidth ?? 0) > Number(left.bandwidth ?? 0) ? right : left,
  );
  const url = best.baseUrl ?? best.base_url;
  if (!url) throw new BiliError("bili_no_audio", "该内容没有可用的音频流");
  return {
    url,
    backup: best.backupUrl?.[0] ?? best.backup_url?.[0] ?? null,
    mime: String(best.mimeType ?? best.mime_type ?? "audio/mp4"),
  };
}

export function downloadHeaders(bvid) {
  return {
    "User-Agent": USER_AGENT,
    Referer: bvid ? `https://www.bilibili.com/video/${bvid}` : REFERER,
    Origin: "https://www.bilibili.com",
  };
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .trim();
}

function parseDuration(value) {
  if (typeof value === "number") return value;
  const parts = String(value ?? "")
    .split(":")
    .map((item) => Number(item));
  if (parts.some((item) => !Number.isFinite(item))) return 0;
  return parts.reduce((total, item) => total * 60 + item, 0);
}

export async function searchVideos(keyword, limit = 20, cookie) {
  const query = await signedQuery({
    search_type: "video",
    keyword,
    page: 1,
    page_size: Math.min(30, Math.max(1, limit)),
  });
  const data = await biliJson(
    `https://api.bilibili.com/x/web-interface/wbi/search/type?${query}`,
    { cookie: cookie || (await anonymous()) },
  );
  const list = Array.isArray(data?.result) ? data.result : [];
  return list
    .filter((item) => item.bvid)
    .map((item) => ({
      bvid: String(item.bvid),
      title: stripTags(item.title),
      author: stripTags(item.author),
      cover: normalizeImage(item.pic),
      duration: parseDuration(item.duration),
      play: Number(item.play ?? 0) || null,
    }));
}
