import { useState } from "react";
import type { Track } from "../api/types";
import { useApp } from "../state/AppStore";
import { useToast } from "../state/ToastStore";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function PlaylistPicker({ track, onClose }: { track: Track; onClose: () => void }) {
  const { playlists, addToPlaylist, createPlaylist, attempt } = useApp();
  const { push } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (playlistId: number) => {
    if (busy) return;
    setBusy(true);
    const duplicated = await attempt(() => addToPlaylist(playlistId, track.id));
    setBusy(false);
    if (duplicated === null) return;
    push(duplicated ? "这首歌已经在这个歌单里了" : "已加入歌单");
    onClose();
  };

  const create = async () => {
    const value = name.trim();
    if (!value || busy) return;
    setBusy(true);
    const playlist = await attempt(() => createPlaylist(value));
    if (!playlist) {
      setBusy(false);
      return;
    }
    const duplicated = await attempt(() => addToPlaylist(playlist.id, track.id));
    setBusy(false);
    if (duplicated === null) return;
    push("已新建歌单并加入这首歌");
    onClose();
  };

  return (
    <Modal title="加入歌单" subtitle={track.title} onClose={onClose}>
      <div className="formstack">
        {playlists.length === 0 ? (
          <p className="confirm__text">还没有歌单，在下面新建一个就能直接加入。</p>
        ) : (
          <div className="picker">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="picker__item"
                onClick={() => void add(playlist.id)}
                disabled={busy}
              >
                <Icon name="list" size={15} />
                <span>{playlist.name}</span>
                <small className="num">{playlist.trackCount}</small>
              </button>
            ))}
          </div>
        )}

        <div className="divider" />

        <label className="field">
          <span className="field__label">新建歌单</span>
          <input
            value={name}
            maxLength={80}
            placeholder="例如：深夜慢放"
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void create();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--quiet btn--block"
          onClick={() => void create()}
          disabled={!name.trim() || busy}
        >
          新建并加入
        </button>
      </div>
    </Modal>
  );
}
