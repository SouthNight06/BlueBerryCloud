import { DEMO_TRACKS } from "./demoAudio.js";

const haystackOf = (track) =>
  [track.title, track.artist, track.album, ...track.tags].join(" ").toLowerCase();

export const demoSource = {
  id: "demo",
  name: "示例曲库",
  description: "内置离线示例曲目（本地合成音频），无需联网即可搜索、试听、导入与下载",
  supportsDownload: true,
  offline: true,

  async search(query, { limit = 20 } = {}) {
    const tokens = String(query || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const matched =
      tokens.length === 0
        ? DEMO_TRACKS
        : DEMO_TRACKS.filter((track) => {
            const haystack = haystackOf(track);
            return tokens.every((token) => haystack.includes(token));
          });

    return matched.slice(0, limit).map((track) => ({
      source: "demo",
      sourceId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      coverUrl: null,
      license: "CC0 · 本地合成示例",
      resolved: false,
    }));
  },

  async resolve(sourceId) {
    const track = DEMO_TRACKS.find((item) => item.id === sourceId);
    if (!track) throw new Error("示例曲目不存在");

    return {
      source: "demo",
      sourceId: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      streamUrl: `/media/demo/${track.fileName}`,
      coverUrl: null,
      license: "CC0 · 本地合成示例",
      resolved: true,
    };
  },
};
