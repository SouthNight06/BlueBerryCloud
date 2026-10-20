export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatTotalDuration(tracks: { duration: number | null }[]): string {
  const total = tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);
  if (total <= 0) return "时长未知";
  if (total < 60) return `${Math.round(total)} 秒`;
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

const ERROR_COPY: Record<string, string> = {
  network_unreachable: "无法连接服务器，请检查网络后重试",
  invalid_credentials: "用户名或密码不正确",
  username_taken: "这个用户名已被占用",
  username_invalid: "用户名需为 3–32 位中文、字母、数字或 _ . -",
  password_too_short: "密码至少 6 位",
  track_not_found: "曲目不存在或已被删除",
  playlist_not_found: "歌单不存在或已被删除",
  playlist_full: "单个歌单最多 500 首",
  theme_not_found: "主题不存在",
  tokens_missing: "主题缺少必填颜色（背景、表面、文字、主色）",
  tokens_invalid: "主题格式不正确",
  unsupported_audio_format: "不支持的音频格式",
  source_not_found: "音源不可用",
  file_required: "请选择音频文件",
  no_audio_source: "该曲目没有可播放的音频",
  download_failed: "下载失败，请稍后再试",
};

export function describeError(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code: unknown }).code);
    if (ERROR_COPY[code]) return ERROR_COPY[code];
    if (code.startsWith("source_unavailable:")) {
      const source = code.split(":")[1];
      return `音源 ${source} 暂时不可用，可改用其他来源`;
    }
    if (code.startsWith("source_resolve_failed")) return "该曲目无法解析音频地址";
    if (code.startsWith("token_")) return "主题中有不合法的取值";
    return code.replace(/_/g, " ");
  }
  if (error instanceof Error) return error.message;
  return "出现未知错误";
}

export function trackSeed(track: { id?: number; sourceId?: string | null; title: string }): string {
  return `${track.sourceId ?? track.id ?? ""}${track.title}`;
}
