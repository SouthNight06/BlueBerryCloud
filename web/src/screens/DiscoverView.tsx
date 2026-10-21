import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { api } from "../api/client";
import { LOCAL_MODE } from "../api/mode";
import type { SearchResult, SourceStatus, Track } from "../api/types";
import { Icon } from "../components/Icon";
import { PlaylistPicker } from "../components/PlaylistPicker";
import { TrackRow } from "../components/TrackRow";
import { describeError } from "../lib/format";
import { routeHref } from "../lib/route";
import { useApp } from "../state/AppStore";
import { usePlayback } from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";

const SUGGESTIONS = ["Night", "Glass", "Fern"];

export function DiscoverView() {
  const { sources, tracks, ensureTrack, uploadTrack, downloadTrack, attempt } = useApp();
  const { currentId, playing, play } = usePlayback();
  const { push } = useToast();

  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickTarget, setPickTarget] = useState<Track | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (LOCAL_MODE) {
      setResults([]);
      setStatuses([]);
      setSearching(false);
      setError("");
      return;
    }

    const value = query.trim();
    if (!value) {
      setResults([]);
      setStatuses([]);
      setError("");
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      api
        .search(value, source, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setResults(data.results);
          setStatuses(data.status);
          setError("");
        })
        .catch((failure) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatuses([]);
          setError(describeError(failure));
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 380);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, source]);

  const resolve = async (result: SearchResult): Promise<Track | null> => {
    const key = `${result.source}:${result.sourceId}`;
    const existing = tracks.find(
      (track) => track.source === result.source && track.sourceId === result.sourceId,
    );
    if (existing) return existing;

    setBusyKey(key);
    const track = await attempt(() => ensureTrack(result));
    setBusyKey(null);
    return track;
  };

  const playResult = async (result: SearchResult) => {
    if (busyKey) return;
    const track = await resolve(result);
    if (track) play([track], 0);
  };

  const downloadResult = async (result: SearchResult) => {
    if (busyKey) return;
    const track = await resolve(result);
    if (track) downloadTrack(track);
  };

  const addResult = async (result: SearchResult) => {
    if (busyKey) return;
    const track = await resolve(result);
    if (track) setPickTarget(track);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || uploading) return;

    setUploading(true);
    const track = await attempt(() => uploadTrack(file));
    setUploading(false);
    if (track) {
      push("已导入本地音频");
      setQuery("");
    }
  };

  const degraded = statuses.filter((item) => !item.ok);
  const trimmed = query.trim();
  const localHits =
    LOCAL_MODE && trimmed
      ? tracks.filter((track) =>
          `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(trimmed.toLowerCase()),
        )
      : [];

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">发现</h1>
          <p className="view__sub">
            {LOCAL_MODE
              ? "把本机音频导入曲库，歌曲、歌单与设置都只保存在这台设备上。"
              : "搜索合规曲库，或把本地音频导入音乐库；歌单与主题都同步在服务器。"}
          </p>
        </div>
        <div className="view__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="upload" size={15} />
            {uploading ? "导入中…" : "导入本地音频"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,audio/*"
            hidden
            onChange={(event) => void upload(event)}
          />
        </div>
      </header>

      <div className="searchrow">
        <div className="searchrow__input">
          <Icon name="search" size={16} />
          <input
            value={query}
            placeholder={LOCAL_MODE ? "搜索本机曲库" : "搜索曲名、艺术家或专辑"}
            onChange={(event) => setQuery(event.currentTarget.value)}
            aria-label="搜索音乐"
          />
          {query ? (
            <button type="button" className="ibtn" onClick={() => setQuery("")} aria-label="清空搜索">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {LOCAL_MODE ? null : (
        <div className="filters">
        <button
          type="button"
          className="chip"
          aria-pressed={source === "all"}
          onClick={() => setSource("all")}
        >
          <span className="dot" />
          全部来源
        </button>
        {sources.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={source === item.id}
            onClick={() => setSource(item.id)}
            title={item.description}
          >
            <span className={item.offline ? "dot dot--off" : "dot"} />
            {item.name}
          </button>
        ))}
        </div>
      )}

      {degraded.length > 0 ? (
        <div className="notice">
          <Icon name="cloud" size={15} />
          <span>
            {degraded.map((item) => `${item.name} 暂时不可用（${item.error ?? "无响应"}）`).join("；")}
            ，其余来源仍会正常返回结果。
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="notice">
          <Icon name="cloud" size={15} />
          <span>{error}</span>
        </div>
      ) : null}

      {LOCAL_MODE && trimmed ? (
        <section className="view__section">
          <div className="view__legend">
            <span>本机曲库</span>
            <span className="num">{localHits.length} 首</span>
          </div>

          {localHits.length > 0 ? (
            <div className="rows">
              {localHits.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  position={index + 1}
                  active={track.id === currentId}
                  playing={playing}
                  onPlay={() => play(localHits, index)}
                  actions={
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() => setPickTarget(track)}
                      aria-label="加入歌单"
                      title="加入歌单"
                    >
                      <Icon name="plus" size={15} />
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <span className="empty__icon">
                <Icon name="search" size={22} />
              </span>
              <div className="empty__title">没有找到结果</div>
              <p className="empty__text">本机曲库里没有匹配的歌，换个关键词，或先导入音频。</p>
            </div>
          )}
        </section>
      ) : null}

      {!LOCAL_MODE && trimmed ? (
        <section className="view__section">
          <div className="view__legend">
            <span>{searching ? "搜索中…" : "搜索结果"}</span>
            <span className="num">{results.length} 首</span>
          </div>

          {results.length > 0 ? (
            <div className="rows">
              {results.map((result, index) => {
                const key = `${result.source}:${result.sourceId}`;
                const imported = tracks.find(
                  (track) => track.source === result.source && track.sourceId === result.sourceId,
                );
                const active = Boolean(imported && imported.id === currentId);
                return (
                  <TrackRow
                    key={key}
                    track={result}
                    position={index + 1}
                    active={active}
                    playing={playing}
                    onPlay={() => void playResult(result)}
                    actions={
                      <>
                        <button
                          type="button"
                          className="ibtn"
                          onClick={() => void downloadResult(result)}
                          disabled={busyKey === key}
                          aria-label="下载"
                          title="下载"
                        >
                          <Icon name="download" size={15} />
                        </button>
                        <button
                          type="button"
                          className="ibtn"
                          onClick={() => void addResult(result)}
                          disabled={busyKey === key}
                          aria-label="加入歌单"
                          title="加入歌单"
                        >
                          <Icon name="plus" size={15} />
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          ) : null}

          {!searching && !error && results.length === 0 ? (
            <div className="empty">
              <span className="empty__icon">
                <Icon name="search" size={22} />
              </span>
              <div className="empty__title">没有找到结果</div>
              <p className="empty__text">
                换个关键词，或切换上面的来源再试。外网音源不可用时，本地曲库仍可直接播放。
              </p>
            </div>
          ) : null}
        </section>
      ) : tracks.length > 0 && !(LOCAL_MODE && trimmed) ? (
        <section className="view__section">
          <div className="view__legend">
            <span>音乐库最新</span>
            <a className="tag" href={routeHref({ name: "library" })}>
              查看全部
              <Icon name="chevron-right" size={13} />
            </a>
          </div>
          <div className="rows">
            {tracks.slice(0, 6).map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                position={index + 1}
                active={track.id === currentId}
                playing={playing}
                onPlay={() => play(tracks.slice(0, 6), index)}
                actions={
                  <>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() => downloadTrack(track)}
                      aria-label="下载"
                      title="下载"
                    >
                      <Icon name="download" size={15} />
                    </button>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() => setPickTarget(track)}
                      aria-label="加入歌单"
                      title="加入歌单"
                    >
                      <Icon name="plus" size={15} />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : LOCAL_MODE && trimmed ? null : (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="disc" size={24} />
          </span>
          <div className="empty__title">从一首歌开始</div>
          <p className="empty__text">
            {LOCAL_MODE
              ? "点右上角「导入本地音频」把手机、电脑里的音频加进来。歌曲与歌单只保存在本机。"
              : "在上方搜索合规曲库，或把手机、电脑里的音频文件导入。导入后的歌曲可以加入歌单并同步到云端。"}
          </p>
          {LOCAL_MODE ? null : (
            <div className="hints">
              {SUGGESTIONS.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="chip"
                  onClick={() => setQuery(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {pickTarget ? (
        <PlaylistPicker track={pickTarget} onClose={() => setPickTarget(null)} />
      ) : null}
    </div>
  );
}
