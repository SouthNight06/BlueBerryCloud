import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { api } from "../api/client";
import type { LyricSearchItem, Track } from "../api/types";
import { describeError, formatTime } from "../lib/format";
import { parseLrc } from "../lib/lrc";
import { useLyric } from "../lib/useLyric";
import { usePlayer } from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

type Tab = "edit" | "search" | "ai";

const SOURCE_LABEL: Record<string, string> = {
  manual: "手动编辑",
  import: "本地导入",
  ai: "AI 生成",
  lrclib: "lrclib.net",
  "lrclib.net": "lrclib.net",
};

export function LyricsModal({ track, onClose }: { track: Track | null; onClose: () => void }) {
  const { lyric, loading, apply } = useLyric(track?.id ?? null);
  const { progress } = usePlayer();
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>("edit");
  const [draft, setDraft] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState(track?.title ?? "");
  const [artist, setArtist] = useState(track?.artist ?? "");
  const [results, setResults] = useState<LyricSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [language, setLanguage] = useState("中文");
  const [hint, setHint] = useState("");
  const [generating, setGenerating] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(lyric?.lrc ?? "");
    setSource(lyric?.source ?? "manual");
  }, [lyric]);

  useEffect(() => {
    setQuery(track?.title ?? "");
    setArtist(track?.artist ?? "");
    setResults([]);
    setTab("edit");
  }, [track?.id, track?.title, track?.artist]);

  const parsed = useMemo(() => parseLrc(draft), [draft]);
  const dirty = (lyric?.lrc ?? "") !== draft;

  if (!track) return null;

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      push("歌词内容不能为空", "error");
      return;
    }
    setSaving(true);
    try {
      const { lyric: saved } = await api.saveLyric(track.id, text, source);
      apply(saved);
      push("歌词已保存");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.deleteLyric(track.id);
      apply(null);
      setDraft("");
      push("已移除这首歌的歌词");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const search = async () => {
    const value = query.trim();
    if (!value || searching) return;
    setSearching(true);
    try {
      const data = await api.searchLyrics(value, artist.trim(), track.duration ?? 0);
      setResults(data.results);
      if (data.results.length === 0) push("没有找到匹配的歌词，可以试试 AI 生成");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setSearching(false);
    }
  };

  const useResult = (item: LyricSearchItem) => {
    setDraft(item.lrc);
    setSource(item.provider);
    setTab("edit");
    push("已填入歌词，记得点保存");
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      setDraft(text);
      setSource("import");
      setTab("edit");
      push("已读入 LRC 文件");
    } catch {
      push("无法读取这个文件", "error");
    }
  };

  const generate = async () => {
    if (generating) return;
    if (dirty && draft.trim()) {
      const ok = window.confirm("AI 会覆盖当前编辑中的歌词，确定继续？");
      if (!ok) return;
    }
    setGenerating(true);
    try {
      const data = await api.generateLyric(track.id, {
        duration: track.duration ?? 0,
        hint: hint.trim(),
        language,
      });
      apply(data.lyric);
      setDraft(data.lyric.lrc);
      setSource("ai");
      setTab("edit");
      push("AI 歌词已生成");
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      title="歌词"
      subtitle={`${track.title}${track.artist ? ` · ${track.artist}` : ""}`}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="lyric__meta">
            {loading
              ? "读取中…"
              : parsed.synced
                ? `${parsed.lines.length} 行 · 已同步`
                : draft.trim()
                  ? "纯文本歌词"
                  : "还没有歌词"}
            {lyric ? ` · 来源 ${SOURCE_LABEL[lyric.source] ?? lyric.source}` : ""}
          </span>
          <div className="lyric__foot-acts">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => void remove()}
              disabled={saving || (!lyric && !draft.trim())}
            >
              移除
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void save()}
              disabled={saving || !draft.trim() || !dirty}
            >
              {saving ? "保存中…" : "保存歌词"}
            </button>
          </div>
        </>
      }
    >
      <div className="filters lyric__tabs">
        <button
          type="button"
          className="chip"
          aria-pressed={tab === "edit"}
          onClick={() => setTab("edit")}
        >
          <Icon name="edit" size={13} />
          编辑
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={tab === "search"}
          onClick={() => setTab("search")}
        >
          <Icon name="search" size={13} />
          在线搜索
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={tab === "ai"}
          onClick={() => setTab("ai")}
        >
          <Icon name="sparkle" size={13} />
          AI 生成
        </button>
      </div>

      {tab === "edit" ? (
        <div className="lyric__edit">
          <div className="lyric__toolbar">
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} />
              导入 LRC 文件
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".lrc,.txt,text/plain"
              hidden
              onChange={(event) => void importFile(event)}
            />
            <span className="lyric__now num">当前 {formatTime(progress)}</span>
          </div>
          <textarea
            className="lyric__textfield scroll"
            value={draft}
            spellCheck={false}
            placeholder={"[00:12.34]第一句歌词\n[00:18.02]第二句歌词"}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setSource("manual");
            }}
          />
          <p className="lyric__hint">
            支持标准 LRC：每行以 [分:秒.毫秒] 开头；没有时间戳的纯文本也能保存，但不会逐行滚动。
          </p>
        </div>
      ) : null}

      {tab === "search" ? (
        <div className="lyric__search">
          <div className="field field--row">
            <input
              value={query}
              placeholder="曲名"
              onChange={(event) => setQuery(event.currentTarget.value)}
              aria-label="歌词搜索曲名"
            />
            <input
              value={artist}
              placeholder="艺术家"
              onChange={(event) => setArtist(event.currentTarget.value)}
              aria-label="歌词搜索艺术家"
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void search()}
              disabled={searching || !query.trim()}
            >
              {searching ? "搜索中…" : "搜索"}
            </button>
          </div>

          {results.length > 0 ? (
            <div className="lyric__results scroll">
              {results.map((item) => (
                <div className="lyric__result" key={`${item.provider}:${item.id}`}>
                  <div className="lyric__result-main">
                    <span className="lyric__result-title">{item.title || "未命名"}</span>
                    <span className="lyric__result-meta">
                      {[item.artist, item.album].filter(Boolean).join(" · ") || "未知信息"}
                      {item.duration ? ` · ${formatTime(item.duration)}` : ""}
                    </span>
                  </div>
                  <span className={item.synced ? "tag" : "tag muted"}>
                    {item.synced ? "逐行同步" : "纯文本"}
                  </span>
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => useResult(item)}
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty__icon">
                <Icon name="lyrics" size={22} />
              </span>
              <div className="empty__title">{searching ? "正在搜索歌词" : "还没有搜索结果"}</div>
              <p className="empty__text">
                歌词来自 lrclib.net 公共曲库。找不到时，可以改用 AI 生成或手动粘贴 LRC。
              </p>
            </div>
          )}
        </div>
      ) : null}

      {tab === "ai" ? (
        <div className="lyric__ai">
          <p className="lyric__hint">
            AI 会按歌曲时长与情绪生成原创 LRC，不会复制原曲歌词。需要服务器配置 AI 接口后才可用。
          </p>
          <div className="field">
            <span className="field__label">语言</span>
            <select value={language} onChange={(event) => setLanguage(event.currentTarget.value)}>
              <option value="中文">中文</option>
              <option value="英文">英文</option>
              <option value="日文">日文</option>
              <option value="纯音乐（无词）">纯音乐（无词）</option>
            </select>
          </div>
          <div className="field">
            <span className="field__label">补充描述（可选）</span>
            <textarea
              value={hint}
              maxLength={400}
              placeholder="例如：雨夜的便利店、缓慢的钢琴、副歌更明亮"
              onChange={(event) => setHint(event.currentTarget.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => void generate()}
            disabled={generating}
          >
            <Icon name="sparkle" size={15} />
            {generating ? "生成中，请稍候…" : "生成歌词"}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
