export function toTrack(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration ?? null,
    source: row.source,
    sourceId: row.source_id ?? null,
    streamUrl: `/api/tracks/${row.id}/stream`,
    downloadUrl: `/api/tracks/${row.id}/download`,
    coverUrl: row.cover_url ?? null,
    license: row.license ?? null,
    local: Boolean(
      row.file_path ||
        (typeof row.stream_url === "string" && row.stream_url.startsWith("/media/")),
    ),
    createdAt: row.created_at,
  };
}

export function toPlaylist(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    trackCount: Number(row.track_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTheme(row) {
  return {
    id: `user:${row.id}`,
    numericId: row.id,
    name: row.name,
    builtin: false,
    tokens: safeParse(row.tokens),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
