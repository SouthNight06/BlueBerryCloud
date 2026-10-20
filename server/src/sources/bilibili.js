import { getAccount } from "../bilibili/account.js";
import {
  downloadHeaders,
  fetchAudioStream,
  fetchVideo,
  searchVideos,
} from "../bilibili/client.js";
import { cacheCover } from "../bilibili/cover.js";
import { saveRemoteAudio } from "../download.js";

export const SOURCE_ID = "bilibili";
const BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

export function parseSourceId(raw) {
  const [bvid = "", cid] = String(raw ?? "").split(":");
  return {
    bvid: bvid.trim(),
    cid: cid && /^\d+$/.test(cid) ? Number(cid) : null,
  };
}

export function sourceIdOf(bvid, cid) {
  return cid ? `${bvid}:${cid}` : bvid;
}

export function isBiliId(raw) {
  return BVID_PATTERN.test(parseSourceId(raw).bvid);
}

export const bilibiliSource = {
  id: SOURCE_ID,
  name: "哔哩哔哩",
  description: "登录后可搜索视频、浏览收藏夹，并把音频下载到音乐库",
  supportsDownload: true,

  async search(query, { limit = 20, userId = null } = {}) {
    const account = userId ? getAccount(userId) : null;
    if (!account) throw new Error("bilibili_login_required");
    const items = await searchVideos(query, limit, account.cookie);
    return items.map((item) => ({
      source: SOURCE_ID,
      sourceId: item.bvid,
      title: item.title,
      artist: item.author,
      album: "",
      year: "",
      duration: item.duration || null,
      coverUrl: item.cover,
      license: "哔哩哔哩",
      resolved: false,
    }));
  },

  async resolve(rawSourceId, { userId = null } = {}) {
    return this.ingest(rawSourceId, { userId });
  },

  async ingest(rawSourceId, { userId = null } = {}) {
    const { bvid, cid } = parseSourceId(rawSourceId);
    if (!BVID_PATTERN.test(bvid)) throw new Error("bilibili_invalid_id");

    const account = userId ? getAccount(userId) : null;
    const video = await fetchVideo(bvid);
    const page = cid
      ? video.pages.find((item) => item.cid === cid)
      : video.pages[0];
    if (!page) throw new Error("bilibili_page_missing");

    const stream = await fetchAudioStream(account?.cookie, bvid, page.cid);
    const { filename } = await saveRemoteAudio({
      url: stream.url,
      headers: downloadHeaders(bvid),
      extension: ".m4a",
    });

    const multi = video.pages.length > 1;
    const coverUrl = await cacheCover(video.cover);

    return {
      source: SOURCE_ID,
      sourceId: sourceIdOf(bvid, multi ? page.cid : null),
      title: (multi ? `${video.title} · ${page.title}` : video.title).slice(0, 200),
      artist: video.author.slice(0, 200),
      album: (multi ? video.title : "").slice(0, 200),
      duration: page.duration || video.duration || null,
      filePath: filename,
      coverUrl,
      license: "哔哩哔哩",
    };
  },
};
