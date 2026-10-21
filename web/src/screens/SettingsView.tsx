import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api/client";
import type { BiliAccount, CacheStats } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { describeError, formatBytes, formatDate } from "../lib/format";
import { waveBus } from "../lib/spectrum";
import { useApp } from "../state/AppStore";
import {
  DJ_STRENGTH_MAX,
  DJ_STRENGTH_MIN,
  normalizeDjStrength,
} from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";
import { useUi } from "../state/UiStore";

const VERSION = "1.0.8";

const CREDITS = [
  {
    name: "downkyicore",
    note: "哔哩哔哩登录、收藏夹解析与音频下载思路",
    href: "https://github.com/crazysmile-PhD/downkyicore",
  },
  {
    name: "lrc-maker",
    note: "歌词编辑器交互与 LRC 时间轴规范",
    href: "https://github.com/magic-akari/lrc-maker",
  },
  {
    name: "StatusBarLyric",
    note: "桌面歌词浮层的呈现方式",
    href: "https://github.com/Block-Network/StatusBarLyric",
  },
  {
    name: "lrclib.net",
    note: "在线歌词检索数据源",
    href: "https://lrclib.net",
  },
  {
    name: "猫啃珠圆体",
    note: "界面中文字体，遵循 SIL Open Font License 1.1",
    href: "https://www.fonts.net.cn/font-42220289791.html",
  },
];

const CACHE_ROWS = [
  { key: "covers", label: "封面缓存", hint: "专辑与视频封面缩略图" },
  { key: "audio", label: "音频文件", hint: "已入库的曲目，清理缓存不会删除" },
  { key: "orphans", label: "残留文件", hint: "数据库里已经找不到归属的临时文件" },
] as const;

export function SettingsView() {
  const { user, settings, tracks, playlists, updatePreferences, attempt, logout } = useApp();
  const { push } = useToast();
  const { desktopLyrics, setDesktopLyrics } = useUi();

  const [bili, setBili] = useState<BiliAccount | null>(null);
  const [biliExpired, setBiliExpired] = useState(false);
  const [biliBusy, setBiliBusy] = useState(true);
  const [biliError, setBiliError] = useState("");

  const [cache, setCache] = useState<CacheStats | null>(null);
  const [clearing, setClearing] = useState<"" | "covers" | "orphans" | "all">("");

  const [pending, setPending] = useState<"app" | "bili" | null>(null);
  const [busy, setBusy] = useState(false);

  const preferences = settings?.preferences ?? {};
  const balance = Boolean(preferences.volumeBalance);
  const djMode = Boolean(preferences.djMode);
  const djStrength = normalizeDjStrength(preferences.djStrength);
  const [strengthDraft, setStrengthDraft] = useState(djStrength);
  const autoTempo = preferences.djAutoTempo !== false;
  const [tempo, setTempo] = useState({ bpm: 0, factor: 1 });

  useEffect(() => {
    setStrengthDraft(djStrength);
  }, [djStrength]);

  useEffect(() => {
    if (!djMode) {
      setTempo({ bpm: 0, factor: 1 });
      return;
    }
    const timer = window.setInterval(() => {
      setTempo((current) =>
        Math.abs(current.bpm - waveBus.bpm) < 1 && Math.abs(current.factor - waveBus.tempoFactor) < 0.01
          ? current
          : { bpm: waveBus.bpm, factor: waveBus.tempoFactor },
      );
    }, 700);
    return () => window.clearInterval(timer);
  }, [djMode]);

  const loadBili = useCallback(async () => {
    setBiliBusy(true);
    setBiliError("");
    try {
      const { account, expired } = await api.biliAccount();
      setBili(account);
      setBiliExpired(Boolean(expired));
    } catch (error) {
      setBiliError(describeError(error));
    } finally {
      setBiliBusy(false);
    }
  }, []);

  const loadCache = useCallback(async () => {
    try {
      const { cache: next } = await api.getCache();
      setCache(next);
    } catch (error) {
      push(describeError(error), "error");
    }
  }, [push]);

  useEffect(() => {
    void loadBili();
    void loadCache();
  }, [loadBili, loadCache]);

  const toggleBalance = async () => {
    const next = !balance;
    const ok = await attempt(async () => {
      await updatePreferences({ volumeBalance: next });
      return true;
    });
    if (ok) push(next ? "已开启音量平衡" : "已关闭音量平衡");
  };

  const toggleDesktopLyrics = () => {
    const next = !desktopLyrics;
    setDesktopLyrics(next);
    push(next ? "已打开桌面歌词" : "已关闭桌面歌词");
  };

  const toggleDj = async () => {
    const next = !djMode;
    const ok = await attempt(async () => {
      await updatePreferences({ djMode: next });
      return true;
    });
    if (ok) push(next ? "已开启 DJ 模式" : "已关闭 DJ 模式");
  };

  const previewStrength = (value: number) => {
    setStrengthDraft(value);
    if (djMode) {
      document.documentElement.style.setProperty("--dj-strength", value.toFixed(2));
    }
  };

  const commitStrength = async () => {
    if (Math.abs(strengthDraft - djStrength) < 0.05) return;
    const ok = await attempt(async () => {
      await updatePreferences({ djStrength: strengthDraft });
      return true;
    });
    if (ok) push(`DJ 强度已设为 ${strengthDraft.toFixed(1)}×`);
  };

  const strengthFill = ((strengthDraft - DJ_STRENGTH_MIN) / (DJ_STRENGTH_MAX - DJ_STRENGTH_MIN)) * 100;

  const toggleAutoTempo = async () => {
    const next = !autoTempo;
    const ok = await attempt(async () => {
      await updatePreferences({ djAutoTempo: next });
      return true;
    });
    if (ok) push(next ? "已开启节拍自适应强度" : "已关闭节拍自适应强度");
  };

  const clearCache = async (target: "covers" | "orphans" | "all") => {
    if (clearing) return;
    setClearing(target);
    try {
      const result = await api.clearCache(target);
      setCache(result.cache);
      push(result.removed > 0 ? `已清理 ${result.removed} 个文件` : "没有需要清理的文件");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setClearing("");
    }
  };

  const confirmPending = async () => {
    if (!pending || busy) return;
    const target = pending;
    setBusy(true);
    if (target === "app") {
      setBusy(false);
      setPending(null);
      logout();
      return;
    }
    try {
      const { removed } = await api.biliLogout();
      setBili(null);
      setBiliExpired(false);
      push(removed ? "已退出哔哩哔哩账号" : "哔哩哔哩账号已经解绑");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">设置</h1>
          <p className="view__sub">账号、声音、缓存与开源说明都收在这一页。</p>
        </div>
      </header>

      <section className="view__section">
        <div className="view__legend">
          <span>小云畅听账号</span>
          <span className="num">{tracks.length + playlists.length}</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            <span className="setavatar" aria-hidden="true">
              {user.username.slice(0, 1)}
            </span>
            <div className="setrow__main">
              <div className="setrow__title">{user.username}</div>
              <div className="setrow__desc">
                注册于 {formatDate(user.createdAt) || "未知"} · {tracks.length} 首曲目 ·{" "}
                {playlists.length} 个歌单
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => setPending("app")}
              >
                <Icon name="logout" size={15} />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>哔哩哔哩账号</span>
          <span>{bili ? `UID ${bili.mid}` : "未绑定"}</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            {bili?.face ? (
              <img className="setavatar setavatar--img" src={bili.face} alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="setavatar" aria-hidden="true">
                <Icon name="bilibili" size={16} />
              </span>
            )}
            <div className="setrow__main">
              <div className="setrow__title">
                {biliBusy ? "正在读取账号…" : bili ? bili.uname : "还没有登录哔哩哔哩"}
                {bili?.vip ? <span className="setbadge">大会员</span> : null}
              </div>
              <div className="setrow__desc">
                {biliError
                  ? biliError
                  : bili
                    ? `登录信息更新于 ${formatDate(bili.updatedAt) || "未知"}`
                    : "登录后可以浏览收藏夹，把视频里的音频存进曲库。"}
              </div>
            </div>
            <div className="setrow__act">
              {bili ? (
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => setPending("bili")}
                >
                  退出账号
                </button>
              ) : null}
              {biliExpired ? (
                <a className="btn btn--primary btn--sm" href="#/bilibili">
                  重新扫码
                </a>
              ) : (
                <a className="btn btn--quiet btn--sm" href="#/bilibili">
                  <Icon name="bilibili" size={15} />
                  管理
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>声音</span>
          <span>{balance ? "音量平衡已开启" : "音量平衡已关闭"}</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">音量平衡</div>
              <div className="setrow__desc">
                实时测量歌曲响度并自动补偿增益，让小声的歌听得清、大声的歌不刺耳。音量滑块仍然有效。
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                role="switch"
                aria-checked={balance}
                aria-label="音量平衡"
                className="switch"
                data-on={balance ? "true" : "false"}
                onClick={() => void toggleBalance()}
              >
                <span className="switch__knob" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>动效</span>
          <span>{djMode ? "DJ 模式已开启" : "DJ 模式已关闭"}</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">DJ 模式</div>
              <div className="setrow__desc">
                界面与文字会跟着鼓点轻轻弹跳，安静段落自动收敛，暂停时回到静止。系统开启「减少动态效果」时自动停用。
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                role="switch"
                aria-checked={djMode}
                aria-label="DJ 模式"
                className="switch"
                data-on={djMode ? "true" : "false"}
                onClick={() => void toggleDj()}
              >
                <span className="switch__knob" />
              </button>
            </div>
          </div>
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">
                DJ 强度
                <span className="num">{strengthDraft.toFixed(1)}×</span>
              </div>
              <div className="setrow__desc">
                控制字体与封面的上下弹跳幅度。往右拖动更明显，往左更含蓄；暂停时依旧回到静止。
              </div>
              <div className="setrow__slider">
                <input
                  className="range"
                  type="range"
                  min={DJ_STRENGTH_MIN}
                  max={DJ_STRENGTH_MAX}
                  step={0.1}
                  value={strengthDraft}
                  disabled={!djMode}
                  aria-label="DJ 强度"
                  style={{ "--fill": `${strengthFill}%` } as CSSProperties}
                  onChange={(event) => previewStrength(Number(event.currentTarget.value))}
                  onPointerUp={() => void commitStrength()}
                  onKeyUp={() => void commitStrength()}
                  onBlur={() => void commitStrength()}
                />
              </div>
            </div>
          </div>
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">
                跟随节拍自动调节
                {autoTempo && tempo.bpm > 0 ? (
                  <span className="num">
                    {Math.round(tempo.bpm)} BPM · 幅度 {tempo.factor.toFixed(2)}×
                  </span>
                ) : null}
              </div>
              <div className="setrow__desc">
                {autoTempo
                  ? tempo.bpm > 0
                    ? "最近识别到的曲速，小云会按这个 BPM 自动放大或收敛弹跳；上面的滑块仍是基准强度。"
                    : "播放后自动识别曲目速度；识别出来之前先沿用滑块强度。"
                  : "关闭后只按滑块强度弹跳，不随曲目速度变化。"}
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                role="switch"
                aria-checked={autoTempo}
                aria-label="跟随节拍自动调节"
                className="switch"
                data-on={autoTempo ? "true" : "false"}
                onClick={() => void toggleAutoTempo()}
              >
                <span className="switch__knob" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>歌词</span>
          <span>字体：猫啃珠圆体</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">桌面歌词</div>
              <div className="setrow__desc">
                在播放器上方浮出三行歌词，可拖动位置，随播放进度高亮。
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                role="switch"
                aria-checked={desktopLyrics}
                aria-label="桌面歌词"
                className="switch"
                data-on={desktopLyrics ? "true" : "false"}
                onClick={toggleDesktopLyrics}
              >
                <span className="switch__knob" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>缓存</span>
          <span>{cache ? formatBytes(cache.covers.bytes + cache.orphans.bytes) : "读取中"}</span>
        </div>
        <div className="setgroup">
          {CACHE_ROWS.map((row) => {
            const bucket = cache ? cache[row.key] : null;
            return (
              <div className="setrow" key={row.key}>
                <div className="setrow__main">
                  <div className="setrow__title">{row.label}</div>
                  <div className="setrow__desc">{row.hint}</div>
                </div>
                <div className="setrow__act">
                  <span className="setbytes">{bucket ? formatBytes(bucket.bytes) : "—"}</span>
                  <span className="setcount">{bucket ? `${bucket.files} 个文件` : ""}</span>
                </div>
              </div>
            );
          })}
          <div className="setrow setrow--foot">
            <div className="setrow__main">
              <div className="setrow__desc">
                清理只涉及封面与残留文件，已经入库的音频不会被删除。
              </div>
            </div>
            <div className="setrow__act">
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => void clearCache("covers")}
                disabled={Boolean(clearing)}
              >
                {clearing === "covers" ? "清理中…" : "清理封面"}
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() => void clearCache("orphans")}
                disabled={Boolean(clearing)}
              >
                {clearing === "orphans" ? "清理中…" : "清理残留"}
              </button>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => void clearCache("all")}
                disabled={Boolean(clearing)}
              >
                {clearing === "all" ? "清理中…" : "全部清理"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="view__section">
        <div className="view__legend">
          <span>关于与致谢</span>
          <span className="num">v{VERSION}</span>
        </div>
        <div className="setgroup">
          <div className="setrow">
            <div className="setrow__main">
              <div className="setrow__title">小云畅听 · Cloud Music</div>
              <div className="setrow__desc">
                蓝莓与云朵主题。代码与设计以开源方式维护，下面的项目提供了思路、规范或素材。
              </div>
            </div>
            <div className="setrow__act">
              <a
                className="btn btn--quiet btn--sm"
                href="https://github.com/SouthNight06/BlueBerryCloud"
                target="_blank"
                rel="noreferrer noopener"
              >
                仓库
              </a>
            </div>
          </div>
          {CREDITS.map((item) => (
            <div className="setrow" key={item.name}>
              <div className="setrow__main">
                <div className="setrow__title">{item.name}</div>
                <div className="setrow__desc">{item.note}</div>
              </div>
              <div className="setrow__act">
                <a
                  className="setlink"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  查看
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {pending ? (
        <ConfirmDialog
          title={pending === "app" ? "退出登录" : "退出哔哩哔哩"}
          message={
            pending === "app"
              ? "退出后需要重新输入用户名与密码，曲库与歌单仍保存在服务器。"
              : "退出后需要重新扫码才能继续浏览收藏夹，已下载的音频不受影响。"
          }
          confirmLabel="退出"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirmPending()}
        />
      ) : null}
    </div>
  );
}
