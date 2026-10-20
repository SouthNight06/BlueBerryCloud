import { Router } from "express";
import { authRequired } from "../auth.js";
import { AI_BASE_URL, AI_KEY, AI_MODEL } from "../config.js";
import { get, run } from "../db.js";
import { asyncHandler, badRequest, HttpError, optionalInt, str } from "../http.js";
import { ownedTrack } from "../tracks.js";

const router = Router();
const USER_AGENT =
  "CloudMusic/1.0.4 (personal music player; https://github.com/SouthNight06/BlueBerryCloud)";

function toLyric(row) {
  if (!row) return null;
  return {
    trackId: row.track_id,
    lrc: row.lrc,
    source: row.source,
    updatedAt: row.updated_at,
  };
}

router.get(
  "/tracks/:id/lyric",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    const row = get("SELECT * FROM lyrics WHERE track_id = ? AND owner_id = ?", [
      track.id,
      req.user.uid,
    ]);
    res.json({ lyric: toLyric(row) });
  }),
);

router.put(
  "/tracks/:id/lyric",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    const lrc = str(req.body?.lrc, { field: "lrc", max: 100_000, required: true });
    const source = str(req.body?.source, { field: "source", max: 40 }) || "manual";

    run(
      `INSERT INTO lyrics (track_id, owner_id, lrc, source, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(track_id) DO UPDATE SET
         lrc = excluded.lrc,
         source = excluded.source,
         updated_at = excluded.updated_at`,
      [track.id, req.user.uid, lrc, source],
    );

    const row = get("SELECT * FROM lyrics WHERE track_id = ?", [track.id]);
    res.json({ lyric: toLyric(row) });
  }),
);

router.delete(
  "/tracks/:id/lyric",
  authRequired,
  asyncHandler(async (req, res) => {
    const track = ownedTrack(req.user.uid, req.params.id);
    run("DELETE FROM lyrics WHERE track_id = ? AND owner_id = ?", [track.id, req.user.uid]);
    res.json({ removed: true });
  }),
);

router.get(
  "/lyrics/search",
  authRequired,
  asyncHandler(async (req, res) => {
    const query = str(req.query.q, { field: "q", max: 160, required: true });
    const artist = str(req.query.artist, { field: "artist", max: 160 });
    const duration = optionalInt(req.query.duration, {
      field: "duration",
      min: 0,
      max: 86_400,
    });

    const params = new URLSearchParams({ q: artist ? `${artist} ${query}` : query });
    if (artist) params.set("artist_name", artist);
    if (query) params.set("track_name", query);

    let response;
    try {
      response = await fetch(`https://lrclib.net/api/search?${params.toString()}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new HttpError(502, "lyrics_unreachable");
    }
    if (!response.ok) throw new HttpError(502, `lyrics_http_${response.status}`);

    const list = await response.json().catch(() => []);
    const results = (Array.isArray(list) ? list : [])
      .filter((item) => item.syncedLyrics || item.plainLyrics)
      .slice(0, 12)
      .map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.trackName ?? ""),
        artist: String(item.artistName ?? ""),
        album: String(item.albumName ?? ""),
        duration: Number(item.duration ?? 0) || null,
        synced: Boolean(item.syncedLyrics),
        lrc: String(item.syncedLyrics ?? item.plainLyrics ?? ""),
        provider: "lrclib.net",
      }));

    if (duration) {
      results.sort(
        (left, right) =>
          Math.abs((left.duration ?? 0) - duration) -
          Math.abs((right.duration ?? 0) - duration),
      );
    }

    res.json({ results });
  }),
);

function clamp(text, max) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, max);
}

router.post(
  "/tracks/:id/lyric/ai",
  authRequired,
  asyncHandler(async (req, res) => {
    if (!AI_BASE_URL) throw badRequest("ai_not_configured");

    const track = ownedTrack(req.user.uid, req.params.id);
    const duration = optionalInt(req.body?.duration, {
      field: "duration",
      min: 0,
      max: 86_400,
    }) ?? track.duration ?? 0;
    const hint = str(req.body?.hint, { field: "hint", max: 400 });
    const language = str(req.body?.language, { field: "language", max: 20 }) || "auto";

    const prompt = [
      "你是歌词排版助手。请为下面这首歌生成一份可以直接播放的 LRC 歌词。",
      `歌曲：${track.title}`,
      `歌手：${track.artist || "未知"}`,
      track.album ? `专辑：${track.album}` : "",
      duration ? `时长：${Math.round(duration)} 秒` : "",
      hint ? `补充信息：${hint}` : "",
      `语言：${language}`,
      "要求：",
      "1. 只输出 LRC 文本，不要代码块、不要解释。",
      "2. 每行格式为 [mm:ss.xx]歌词，时间戳按歌曲时长均匀推进，最后一行不超过总时长。",
      "3. 8 到 24 行，贴合歌曲情绪，用词克制、有画面感。",
      "4. 不要输出原曲版权歌词，必须是原创内容。",
    ]
      .filter(Boolean)
      .join("\n");

    let response;
    try {
      response = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(AI_KEY ? { Authorization: `Bearer ${AI_KEY}` } : {}),
        },
        body: JSON.stringify({
          model: AI_MODEL,
          temperature: 0.9,
          messages: [
            { role: "system", content: "你输出纯 LRC 文本，绝不添加额外说明。" },
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new HttpError(502, "ai_unreachable");
    }
    if (!response.ok) throw new HttpError(502, `ai_http_${response.status}`);

    const payload = await response.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;
    const lrc = clamp(
      String(content ?? "")
        .replace(/^```[a-z]*\n?/i, "")
        .replace(/```$/g, ""),
      100_000,
    );

    if (!/\[\d{1,3}:\d{2}([.:]\d{1,3})?\]/.test(lrc)) {
      throw new HttpError(502, "ai_invalid_lyric");
    }

    run(
      `INSERT INTO lyrics (track_id, owner_id, lrc, source, updated_at)
       VALUES (?, ?, ?, 'ai', datetime('now'))
       ON CONFLICT(track_id) DO UPDATE SET
         lrc = excluded.lrc,
         source = excluded.source,
         updated_at = excluded.updated_at`,
      [track.id, req.user.uid, lrc],
    );

    const row = get("SELECT * FROM lyrics WHERE track_id = ?", [track.id]);
    res.json({ lyric: toLyric(row) });
  }),
);

export default router;
