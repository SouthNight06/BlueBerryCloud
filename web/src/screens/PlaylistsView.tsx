import { useState } from "react";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { formatDate } from "../lib/format";
import { navigate, routeHref } from "../lib/route";
import { useApp } from "../state/AppStore";
import { useToast } from "../state/ToastStore";

export function PlaylistsView() {
  const { playlists, createPlaylist, attempt } = useApp();
  const { push } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setOpen(false);
    setName("");
    setDescription("");
    setError("");
  };

  const submit = async () => {
    const value = name.trim();
    if (!value) {
      setError("给歌单起个名字");
      return;
    }
    if (busy) return;

    setBusy(true);
    setError("");
    const playlist = await attempt(() =>
      createPlaylist(value, description.trim()),
    );
    setBusy(false);
    if (!playlist) return;

    push("歌单已创建");
    setOpen(false);
    setName("");
    setDescription("");
    navigate({ name: "playlist", id: playlist.id });
  };

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">歌单</h1>
          <p className="view__sub">
            {playlists.length > 0
              ? `${playlists.length} 个歌单，顺序与内容都保存在服务器。`
              : "收藏想反复听的歌，随时同步到其他设备。"}
          </p>
        </div>
        <div className="view__actions">
          <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
            <Icon name="plus" size={15} />
            新建歌单
          </button>
        </div>
      </header>

      {playlists.length > 0 ? (
        <section className="view__section">
          <div className="view__legend">
            <span>全部歌单</span>
            <span className="num">{playlists.length}</span>
          </div>
          <div className="plgrid">
            {playlists.map((playlist) => (
              <a
                key={playlist.id}
                className="plcard"
                href={routeHref({ name: "playlist", id: playlist.id })}
              >
                <Artwork seed={playlist.name} size={46} />
                <span className="plcard__body">
                  <span className="plcard__name">{playlist.name}</span>
                  <span className="plcard__meta">
                    {playlist.trackCount} 首 · {formatDate(playlist.updatedAt)}
                  </span>
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="list" size={24} />
          </span>
          <div className="empty__title">还没有歌单</div>
          <p className="empty__text">
            新建一个歌单，然后从发现或音乐库把歌加进来。歌单会跟随账号同步。
          </p>
          <div className="hints">
            <button type="button" className="btn btn--quiet" onClick={() => setOpen(true)}>
              <Icon name="plus" size={15} />
              新建歌单
            </button>
          </div>
        </div>
      )}

      {open ? (
        <Modal
          title="新建歌单"
          subtitle="名字最多 80 个字符，简介可以留空。"
          onClose={close}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={close} disabled={busy}>
                取消
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void submit()}
                disabled={busy}
              >
                {busy ? "创建中…" : "创建"}
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
                placeholder="例如：午后窗边"
                autoFocus
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">简介</span>
              <textarea
                value={description}
                maxLength={300}
                placeholder="写给这个歌单的一句话"
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </label>
            {error ? <p className="formerr">{error}</p> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
