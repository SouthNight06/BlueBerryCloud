const BASE = "https://archive.org";
const AUDIO_FORMAT_PRIORITY = [
  "VBR MP3",
  "128Kbps MP3",
  "64Kbps MP3",
  "MP3",
  "Ogg Vorbis",
  "Flac",
  "24bit Flac",
  "WAVE",
];

async function fetchJson(url, signal) {
  const res = await fetch(url, {
    signal,
    headers: { "User-Agent": "CloudMusic/1.01 (personal music player)" },
  });
  if (!res.ok) throw new Error(`archive.org ${res.status}`);
  return res.json();
}

function pickAudioFile(files) {
  const audio = files.filter((f) =>
    /\.(mp3|ogg|flac|wav|m4a|aac)$/i.test(String(f.name || "")),
  );
  if (audio.length === 0) return null;
  const rank = (format) => {
    const index = AUDIO_FORMAT_PRIORITY.indexOf(String(format || ""));
    return index === -1 ? AUDIO_FORMAT_PRIORITY.length : index;
  };
  audio.sort((a, b) => rank(a.format) - rank(b.format));
  return audio[0];
}

export const internetArchiveSource = {
  id: "internet_archive",
  name: "Internet Archive",
  description: "公有领域 / Creative Commons 音频馆藏，可直接试听与导入",
  supportsDownload: true,

  async search(query, { limit = 24 } = {}) {
    const params = new URLSearchParams();
    params.set("q", `mediatype:audio AND (${query})`);
    params.set("rows", String(limit));
    params.set("page", "1");
    params.set("output", "json");
    for (const field of [
      "identifier",
      "title",
      "creator",
      "year",
      "licenseurl",
    ]) {
      params.append("fl[]", field);
    }
    params.append("sort[]", "downloads desc");

    const signal = AbortSignal.timeout(15000);
    const data = await fetchJson(
      `${BASE}/advancedsearch.php?${params.toString()}`,
      signal,
    );
    const docs = data?.response?.docs ?? [];

    return docs.map((doc) => ({
      source: "internet_archive",
      sourceId: doc.identifier,
      title: doc.title || doc.identifier,
      artist: normalizeCreator(doc.creator),
      album: "",
      year: doc.year || "",
      coverUrl: `${BASE}/services/img/${encodeURIComponent(doc.identifier)}`,
      license: doc.licenseurl || "",
      resolved: false,
    }));
  },

  async resolve(sourceId) {
    const signal = AbortSignal.timeout(15000);
    const meta = await fetchJson(
      `${BASE}/metadata/${encodeURIComponent(sourceId)}`,
      signal,
    );
    const file = pickAudioFile(meta.files || []);
    if (!file) throw new Error("该条目没有可播放的音频文件");

    const encodedName = encodeURIComponent(file.name);
    const fileMeta = meta?.metadata || {};
    const duration = Number(file.length)
      ? Math.round(Number(file.length))
      : parseRuntime(fileMeta.runtime);

    return {
      source: "internet_archive",
      sourceId,
      title: normalizeTitle(fileMeta.title) || sourceId,
      artist: normalizeCreator(fileMeta.creator),
      album: Array.isArray(fileMeta.collection)
        ? fileMeta.collection[0]
        : fileMeta.collection || "",
      duration,
      streamUrl: `${BASE}/download/${encodeURIComponent(sourceId)}/${encodedName}`,
      coverUrl: `${BASE}/services/img/${encodeURIComponent(sourceId)}`,
      license: fileMeta.licenseurl || file.license || "",
      resolved: true,
    };
  },
};

function normalizeTitle(value) {
  if (Array.isArray(value)) return value[0];
  return value ? String(value) : "";
}

function normalizeCreator(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  return "";
}

function parseRuntime(runtime) {
  if (!runtime) return null;
  const parts = String(runtime).split(":").map((n) => Number(n) || 0);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}
