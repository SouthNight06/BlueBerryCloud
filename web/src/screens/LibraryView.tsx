import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Track } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { PlaylistPicker } from "../components/PlaylistPicker";
import { TrackRow } from "../components/TrackRow";
import { formatDate, formatTotalDuration } from "../lib/format";
import { useApp } from "../state/AppStore";
import { usePlayback } from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";

export function LibraryView() {
  const { tracks, syncedAt, uploadTrack, deleteTrack, downloadTrack, attempt } = useApp();
  const { currentId, playing, play } = usePlayback();
  const { push } = useToast();

  const [filter, setFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Track | null>(null);
  const [pickTarget, setPickTarget] = useState<Track | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return tracks;
    return tracks.filter((track) =>
      [track.title, track.artist, track.album].some((value) =>
        value.toLowerCase().includes(keyword),
      ),
    );
  }, [tracks, filter]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || uploading) return;

    setUploading(true);
    const track = await attempt(() => uploadTrack(file));
    setUploading(false);
    if (track) push(`已导入 ${track.title}`);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    const done = await attempt(async () => {
      await deleteTrack(pendingDelete.id);
      return true;
    });
    setBusy(false);
    if (done) push("已从音乐库移除");
    setPendingDelete(null);
  };

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">音乐库</h1>
          <p className="view__sub">
            {tracks.length} 首 · {formatTotalDuration(tracks)}
            {syncedAt ? ` · 同步于 ${formatDate(syncedAt)}` : ""}
          </p>
        </div>
        <div className="view__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => play(filtered.length > 0 ? filtered : tracks, 0)}
            disabled={tracks.length === 0}
          >
            <Icon name="play" size={15} />
            播放全部
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="upload" size={15} />
            {uploading ? "导入中…" : "导入音频"}
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
            value={filter}
            placeholder="在音乐库中筛选"
            onChange={(event) => setFilter(event.currentTarget.value)}
            aria-label="筛选音乐库"
          />
          {filter ? (
            <button type="button" className="ibtn" onClick={() => setFilter("")} aria-label="清空筛选">
              <Icon name="close" size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length > 0 ? (
        <section className="view__section">
          <div className="view__legend">
            <span>{filter ? "筛选结果" : "全部歌曲"}</span>
            <span className="num">{filtered.length} 首</span>
          </div>
          <div className="rows">
            {filtered.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                position={index + 1}
                active={track.id === currentId}
                playing={playing}
                onPlay={() => play(filtered, index)}
                actions={
                  <>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() => setPickTarget(track)}
                      aria-label="加入歌单"
                      title="加入歌单"
                    >
                      <Icon name="plus" size={15} />
                    </button>
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
                      onClick={() => setPendingDelete(track)}
                      aria-label="从音乐库移除"
                      title="从音乐库移除"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : tracks.length === 0 ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="disc" size={24} />
          </span>
          <div className="empty__title">音乐库还是空的</div>
          <p className="empty__text">
            支持 MP3、FLAC、WAV、OGG、M4A、AAC、OPUS，单个文件最大 200MB。导入后会自动同步到账号。
          </p>
          <div className="hints">
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Icon name="upload" size={15} />
              导入第一首歌
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="search" size={22} />
          </span>
          <div className="empty__title">没有匹配的歌曲</div>
          <p className="empty__text">清空筛选条件，或换个关键词试试。</p>
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="从音乐库移除"
          message={`「${pendingDelete.title}」会从音乐库和所有歌单中移除，该操作无法撤销。`}
          confirmLabel="移除"
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      {pickTarget ? (
        <PlaylistPicker track={pickTarget} onClose={() => setPickTarget(null)} />
      ) : null}
    </div>
  );
}
