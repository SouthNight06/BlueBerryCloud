import { useMemo, useState } from "react";
import type { Track } from "../api/types";
import { Artwork } from "../components/Artwork";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { PlaylistPicker } from "../components/PlaylistPicker";
import { TrackRow } from "../components/TrackRow";
import { formatDate, formatTotalDuration } from "../lib/format";
import { navigate, routeHref } from "../lib/route";
import { useApp } from "../state/AppStore";
import { usePlayback } from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";

export function PlaylistView({ id }: { id: number }) {
  const {
    playlists,
    trackById,
    updatePlaylist,
    deletePlaylist,
    removeFromPlaylist,
    moveInPlaylist,
    downloadTrack,
    attempt,
  } = useApp();
  const { currentId, playing, play } = usePlayback();
  const { push } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickTarget, setPickTarget] = useState<Track | null>(null);

  const playlist = playlists.find((item) => item.id === id);

  const tracks = useMemo(() => {
    if (!playlist) return [];
    return playlist.trackIds
      .map((trackId) => trackById(trackId))
      .filter((track): track is Track => Boolean(track));
  }, [playlist, trackById]);

  const openEditor = () => {
    if (!playlist) return;
    setName(playlist.name);
    setDescription(playlist.description);
    setError("");
    setEditing(true);
  };

  const save = async () => {
    const value = name.trim();
    if (!value) {
      setError("歌单名称不能为空");
      return;
    }
    if (busy) return;

    setBusy(true);
    setError("");
    const done = await attempt(async () => {
      await updatePlaylist(id, { name: value, description: description.trim() });
      return true;
    });
    setBusy(false);
    if (!done) return;

    push("歌单已更新");
    setEditing(false);
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const done = await attempt(async () => {
      await deletePlaylist(id);
      return true;
    });
    setBusy(false);
    setConfirmDelete(false);
    if (!done) return;

    push("歌单已删除");
    navigate({ name: "playlists" });
  };

  const removeTrack = async (track: Track) => {
    const done = await attempt(async () => {
      await removeFromPlaylist(id, track.id);
      return true;
    });
    if (done) push(`已从歌单移除「${track.title}」`);
  };

  if (!playlist) {
    return (
      <div className="view">
        <div className="empty">
          <span className="empty__icon">
            <Icon name="list" size={24} />
          </span>
          <div className="empty__title">歌单不存在</div>
          <p className="empty__text">它可能已经被删除了，回到歌单列表看看其他的。</p>
          <div className="hints">
            <a className="btn btn--quiet" href={routeHref({ name: "playlists" })}>
              返回歌单
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <header className="plhead">
        <Artwork seed={playlist.name} size={84} />
        <div className="plhead__info">
          <h1 className="view__title">{playlist.name}</h1>
          <p className="view__sub">{playlist.description || "还没有简介"}</p>
          <p className="view__sub">
            {tracks.length} 首 · {formatTotalDuration(tracks)} · 更新于{" "}
            {formatDate(playlist.updatedAt)}
          </p>
        </div>
        <div className="view__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => play(tracks, 0)}
            disabled={tracks.length === 0}
          >
            <Icon name="play" size={15} />
            播放
          </button>
          <button type="button" className="btn btn--quiet" onClick={openEditor}>
            <Icon name="edit" size={15} />
            编辑
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setConfirmDelete(true)}
          >
            <Icon name="trash" size={15} />
            删除
          </button>
        </div>
      </header>

      {tracks.length > 0 ? (
        <section className="view__section">
          <div className="view__legend">
            <span>歌曲</span>
            <span className="num">{tracks.length} 首</span>
          </div>
          <div className="rows">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                position={index + 1}
                active={track.id === currentId}
                playing={playing}
                onPlay={() => play(tracks, index)}
                actions={
                  <>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() => setPickTarget(track)}
                      aria-label="加入其他歌单"
                      title="加入其他歌单"
                    >
                      <Icon name="plus" size={15} />
                    </button>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() =>
                        void attempt(async () => {
                          await moveInPlaylist(id, track.id, -1);
                          return true;
                        })
                      }
                      disabled={index === 0}
                      aria-label="上移"
                      title="上移"
                    >
                      <Icon name="arrow-up" size={15} />
                    </button>
                    <button
                      type="button"
                      className="ibtn"
                      onClick={() =>
                        void attempt(async () => {
                          await moveInPlaylist(id, track.id, 1);
                          return true;
                        })
                      }
                      disabled={index === tracks.length - 1}
                      aria-label="下移"
                      title="下移"
                    >
                      <Icon name="arrow-down" size={15} />
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
                      onClick={() => void removeTrack(track)}
                      aria-label="从歌单移除"
                      title="从歌单移除"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="note" size={24} />
          </span>
          <div className="empty__title">歌单还是空的</div>
          <p className="empty__text">
            去发现页搜索，或在音乐库里挑几首，用「加入歌单」放进来。
          </p>
          <div className="hints">
            <a className="btn btn--quiet" href={routeHref({ name: "discover" })}>
              去发现
            </a>
            <a className="btn btn--ghost" href={routeHref({ name: "library" })}>
              打开音乐库
            </a>
          </div>
        </div>
      )}

      {editing ? (
        <Modal
          title="编辑歌单"
          onClose={() => {
            if (!busy) setEditing(false);
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setEditing(false)}
                disabled={busy}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void save()}
                disabled={busy}
              >
                {busy ? "保存中…" : "保存"}
              </button>
            </>
          }
        >
          <div className="formstack">
            <label className="field">
              <span className="field__label">歌单名称</span>
              <input
                value={name}
                maxLength={80}
                autoFocus
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">简介</span>
              <textarea
                value={description}
                maxLength={300}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </label>
            {error ? <p className="formerr">{error}</p> : null}
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title="删除歌单"
          message={`「${playlist.name}」会被删除，其中的歌曲仍保留在音乐库。`}
          confirmLabel="删除歌单"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      ) : null}

      {pickTarget ? (
        <PlaylistPicker track={pickTarget} onClose={() => setPickTarget(null)} />
      ) : null}
    </div>
  );
}
