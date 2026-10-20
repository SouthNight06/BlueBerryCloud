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

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
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
  bilibili_login_required: "请先登录哔哩哔哩账号",
  bilibili_cookie_missing: "登录信息不完整，请重新扫码登录",
  bilibili_invalid_id: "这不是有效的哔哩哔哩视频编号",
  bilibili_page_missing: "该视频没有可用的分 P",
  bilibili_account_expired: "哔哩哔哩登录已失效，请重新扫码",
  bili_login_expired: "哔哩哔哩登录已失效，请重新扫码",
  bili_no_audio: "该视频没有可下载的音频流",
  bili_folder_failed: "无法读取哔哩哔哩收藏夹",
  bili_qr_failed: "二维码生成失败，请稍后重试",
  lyrics_unreachable: "歌词服务暂时不可用",
  ai_not_configured: "服务器还没有配置 AI 接口",
  ai_unreachable: "AI 服务连接失败",
  ai_invalid_lyric: "AI 返回的内容不是有效的 LRC 歌词",
  target_invalid: "清理目标不正确",
  id_invalid: "参数不正确",
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
    if (code.startsWith("bilibili_failed:")) return "哔哩哔哩暂时没有响应，请稍后再试";
    if (code.startsWith("lyrics_http_")) return "歌词服务返回异常，请稍后再试";
    if (code.startsWith("ai_http_")) return "AI 服务返回异常，请稍后再试";
    if (code.startsWith("token_")) return "主题中有不合法的取值";
    return code.replace(/_/g, " ");
  }
  if (error instanceof Error) return error.message;
  return "出现未知错误";
}

export function trackSeed(track: { id?: number; sourceId?: string | null; title: string }): string {
  return `${track.sourceId ?? track.id ?? ""}${track.title}`;
}
