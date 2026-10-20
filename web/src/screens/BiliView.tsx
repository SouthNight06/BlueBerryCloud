import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type {
  BiliAccount,
  BiliFavItem,
  BiliFolder,
  BiliQr,
  BiliQrState,
  BiliVideo,
  Track,
} from "../api/types";
import { Artwork } from "../components/Artwork";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { TrackRow } from "../components/TrackRow";
import type { TrackRowData } from "../components/TrackRow";
import { describeError, formatDate, formatTime } from "../lib/format";
import { useApp } from "../state/AppStore";
import { usePlayback } from "../state/PlayerStore";
import { useToast } from "../state/ToastStore";

const QR_STATE_TEXT: Record<BiliQrState, string> = {
  waiting: "等待扫码",
  scanned: "已扫码，请在手机上确认",
  expired: "二维码已过期，请重新生成",
  ok: "登录成功",
  unknown: "正在等待结果…",
};

type BatchState = { done: number; total: number; failed: number };

export function BiliView() {
  const { tracks, adoptTrack } = useApp();
  const { currentId, playing, play } = usePlayback();
  const { push } = useToast();

  const [account, setAccount] = useState<BiliAccount | null>(null);
  const [accountReady, setAccountReady] = useState(false);

  const [qr, setQr] = useState<BiliQr | null>(null);
  const [qrState, setQrState] = useState<BiliQrState>("waiting");
  const [qrBusy, setQrBusy] = useState(false);

  const [folders, setFolders] = useState<BiliFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const [items, setItems] = useState<BiliFavItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchState | null>(null);
  const batchRef = useRef(false);

  const [video, setVideo] = useState<BiliVideo | null>(null);
  const [videoBusy, setVideoBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    api
      .biliAccount()
      .then((data) => {
        if (!alive) return;
        setAccount(data.account);
        if (data.expired) push("哔哩哔哩登录已失效，请重新扫码", "error");
      })
      .catch(() => {
        /* 未登录或网络异常时，页面仍可展示登录入口 */
      })
      .finally(() => {
        if (alive) setAccountReady(true);
      });
    return () => {
      alive = false;
    };
  }, [push]);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const { folders: list } = await api.biliFolders();
      setFolders(list);
      setActiveId((current) => (list.some((f) => f.id === current) ? current : (list[0]?.id ?? null)));
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setFoldersLoading(false);
    }
  }, [push]);

  useEffect(() => {
    if (!account) {
      setFolders([]);
      setItems([]);
      setActiveId(null);
      return;
    }
    void loadFolders();
  }, [account, loadFolders]);

  const loadPage = useCallback(
    async (folderId: number, nextPage: number, append: boolean) => {
      setItemsLoading(true);
      try {
        const data = await api.biliFolderItems(folderId, nextPage, 30);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(data.page);
        setItems((list) => (append ? [...list, ...data.items] : data.items));
      } catch (error) {
        push(describeError(error), "error");
      } finally {
        setItemsLoading(false);
      }
    },
    [push],
  );

  useEffect(() => {
    if (!activeId) {
      setItems([]);
      setTotal(0);
      setHasMore(false);
      return;
    }
    setItems([]);
    setFilter("");
    void loadPage(activeId, 1, false);
  }, [activeId, loadPage]);

  useEffect(() => {
    if (!qr) return;
    let alive = true;
    let timer = 0;

    const tick = async () => {
      try {
        const result = await api.biliQrPoll(qr.key);
        if (!alive) return;
        setQrState(result.state);
        if (result.state === "ok") {
          setAccount(result.account);
          setQr(null);
          push(`已登录哔哩哔哩：${result.account?.uname ?? "账号"}`);
          return;
        }
        if (result.state === "expired") return;
      } catch (error) {
        if (alive) push(describeError(error), "error");
        return;
      }
      timer = window.setTimeout(() => void tick(), 1600);
    };

    timer = window.setTimeout(() => void tick(), 800);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [qr, push]);

  const startLogin = async () => {
    if (qrBusy) return;
    setQrBusy(true);
    setQrState("waiting");
    try {
      setQr(await api.biliQr());
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setQrBusy(false);
    }
  };

  const doLogout = async () => {
    try {
      await api.biliLogout();
      setAccount(null);
      setFolders([]);
      setItems([]);
      push("已退出哔哩哔哩账号");
    } catch (error) {
      push(describeError(error), "error");
    }
  };

  const resolveTrack = useCallback(
    async (bvid: string, cid?: number): Promise<Track> => {
      const { track } = await api.biliDownload(bvid, cid);
      adoptTrack(track);
      return track;
    },
    [adoptTrack],
  );

  const downloadOne = async (bvid: string, cid?: number) => {
    const key = cid ? `${bvid}:${cid}` : bvid;
    if (busyKey) return;
    setBusyKey(key);
    try {
      const { track, duplicated } = await api.biliDownload(bvid, cid);
      adoptTrack(track);
      push(duplicated ? "这首歌已经在音乐库里了" : `已下载：${track.title}`);
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const playOne = async (bvid: string, cid?: number) => {
    const key = cid ? `${bvid}:${cid}` : bvid;
    if (busyKey) return;
    setBusyKey(key);
    try {
      const track = await resolveTrack(bvid, cid);
      play([track], 0);
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setBusyKey(null);
    }
  };

  const downloadFolder = async () => {
    if (!activeId || batch) return;
    batchRef.current = true;
    setBatch({ done: 0, total: total || 0, failed: 0 });

    let done = 0;
    let failed = 0;
    let pageNo = 1;
    let more = true;

    try {
      while (more && batchRef.current) {
        const data = await api.biliFolderItems(activeId, pageNo, 50);
        for (const item of data.items) {
          if (!batchRef.current) break;
          try {
            await resolveTrack(item.bvid);
            done += 1;
          } catch {
            failed += 1;
          }
          setBatch({ done, total: data.total, failed });
        }
        more = data.hasMore;
        pageNo += 1;
      }
      push(`收藏夹下载完成：成功 ${done} 首${failed ? `，失败 ${failed} 首` : ""}`);
      void loadPage(activeId, 1, false);
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      batchRef.current = false;
      setBatch(null);
    }
  };

  const stopBatch = () => {
    batchRef.current = false;
    setBatch(null);
  };

  const openVideo = async (item: BiliFavItem) => {
    if (videoBusy) return;
    setVideoBusy(item.bvid);
    try {
      const { video: data } = await api.biliVideo(item.bvid);
      setVideo(data);
      setSelected(data.pages[0] ? [data.pages[0].cid] : []);
    } catch (error) {
      push(describeError(error), "error");
    } finally {
      setVideoBusy(null);
    }
  };

  const downloadParts = async () => {
    if (!video) return;
    const pages = video.pages.filter((item) => selected.includes(item.cid));
    const target = video;
    setVideo(null);
    if (pages.length === 0) return;
    for (const item of pages) {
      try {
        const track = await resolveTrack(target.bvid, item.cid);
        push(`已下载：${track.title}`);
      } catch (error) {
        push(describeError(error), "error");
      }
    }
  };

  const imported = useMemo(() => {
    const map = new Map<string, Track>();
    for (const track of tracks) {
      if (track.source === "bilibili" && track.sourceId) map.set(track.sourceId, track);
    }
    return map;
  }, [tracks]);

  const visible = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(keyword) || item.author.toLowerCase().includes(keyword),
    );
  }, [items, filter]);

  const activeFolder = folders.find((folder) => folder.id === activeId) ?? null;

  return (
    <div className="view">
      <header className="view__head">
        <div>
          <h1 className="view__title">哔哩哔哩</h1>
          <p className="view__sub">
            登录后读取收藏夹，把视频里的音频下载进音乐库；支持单曲、整夹一键下载与分 P 选择。
          </p>
        </div>
        <div className="view__actions">
          {account ? (
            <>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => void loadFolders()}
                disabled={foldersLoading}
              >
                <Icon name="repeat" size={15} />
                {foldersLoading ? "刷新中…" : "刷新收藏夹"}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void doLogout()}>
                退出登录
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => void startLogin()}
              disabled={!accountReady || qrBusy}
            >
              <Icon name="bilibili" size={15} />
              {qrBusy ? "生成二维码…" : "扫码登录"}
            </button>
          )}
        </div>
      </header>

      {account ? (
        <div className="bilicard">
          <Artwork seed={account.mid} size={46} cover={account.face} />
          <div className="bilicard__body">
            <strong>{account.uname || "哔哩哔哩账号"}</strong>
            <span className="bilicard__meta">
              UID {account.mid}
              {account.vip ? " · 大会员" : ""}
              {account.updatedAt ? ` · 登录于 ${formatDate(account.updatedAt)}` : ""}
            </span>
          </div>
          <span className="tag">
            <span className="dot" />
            已连接
          </span>
        </div>
      ) : (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="bilibili" size={24} />
          </span>
          <div className="empty__title">先登录哔哩哔哩</div>
          <p className="empty__text">
            用手机哔哩哔哩扫码即可读取你的收藏夹。登录凭证仅保存在你自己的服务器上，可随时在设置里退出。
          </p>
          <div className="hints">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => void startLogin()}
              disabled={!accountReady || qrBusy}
            >
              <Icon name="bilibili" size={14} />
              扫码登录
            </button>
          </div>
        </div>
      )}

      {account ? (
        folders.length > 0 ? (
          <>
            <div className="filters">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="chip"
                  aria-pressed={activeId === folder.id}
                  onClick={() => setActiveId(folder.id)}
                  title={folder.collected ? "收藏的收藏夹" : "自建收藏夹"}
                >
                  <Icon name={folder.collected ? "folder" : "list"} size={13} />
                  {folder.title}
                  <span className="num">{folder.count}</span>
                </button>
              ))}
            </div>

            <section className="view__section">
              <div className="view__legend">
                <span>
                  {activeFolder?.title ?? "收藏夹"}
                  {itemsLoading ? " · 读取中…" : ` · 共 ${total} 个视频`}
                </span>
                <div className="bili__legend-acts">
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => void downloadFolder()} disabled={Boolean(batch) || items.length === 0}>
                    <Icon name="download" size={14} />
                    一键下载收藏夹
                  </button>
                </div>
              </div>

              {batch ? (
                <div className="bili__batch">
                  <div className="bili__batch-bar">
                    <span
                      style={{
                        width: `${batch.total > 0 ? Math.min(100, (batch.done / batch.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="num">
                    {batch.done} / {batch.total || "?"}
                    {batch.failed ? ` · 失败 ${batch.failed}` : ""}
                  </span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={stopBatch}>
                    停止
                  </button>
                </div>
              ) : null}

              <div className="searchrow">
                <div className="searchrow__input">
                  <Icon name="search" size={16} />
                  <input
                    value={filter}
                    placeholder="在当前已加载的收藏里筛选"
                    onChange={(event) => setFilter(event.currentTarget.value)}
                    aria-label="筛选收藏夹"
                  />
                  {filter ? (
                    <button type="button" className="ibtn" onClick={() => setFilter("")} aria-label="清空筛选">
                      <Icon name="close" size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              {visible.length > 0 ? (
                <div className="rows">
                  {visible.map((item, index) => {
                    const owned = imported.get(item.bvid);
                    const row: TrackRowData = {
                      id: owned?.id,
                      title: item.title,
                      artist: item.author,
                      album: "哔哩哔哩收藏夹",
                      duration: item.duration,
                      source: "bilibili",
                      sourceId: item.bvid,
                      coverUrl: item.cover,
                    };
                    return (
                      <TrackRow
                        key={item.bvid}
                        track={row}
                        position={index + 1}
                        active={Boolean(owned && owned.id === currentId)}
                        playing={playing}
                        onPlay={() => void playOne(item.bvid)}
                        actions={
                          <>
                            <button
                              type="button"
                              className="ibtn"
                              onClick={() => void downloadOne(item.bvid)}
                              disabled={busyKey !== null}
                              aria-label="下载"
                              title="下载音频"
                            >
                              <Icon name="download" size={15} />
                            </button>
                            <button
                              type="button"
                              className="ibtn"
                              onClick={() => void openVideo(item)}
                              disabled={videoBusy !== null}
                              aria-label="选集"
                              title="选择分 P"
                            >
                              <Icon name="folder" size={15} />
                            </button>
                          </>
                        }
                      />
                    );
                  })}
                </div>
              ) : null}

              {!itemsLoading && visible.length === 0 ? (
                <div className="empty">
                  <span className="empty__icon">
                    <Icon name="folder" size={22} />
                  </span>
                  <div className="empty__title">这个收藏夹还没有可下载的视频</div>
                  <p className="empty__text">
                    失效视频会被自动跳过。换一个收藏夹，或到哔哩哔哩里先把视频收藏起来。
                  </p>
                </div>
              ) : null}

              {hasMore ? (
                <div className="bili__more">
                  <button
                    type="button"
                    className="btn btn--quiet btn--sm"
                    onClick={() => activeId && void loadPage(activeId, page + 1, true)}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? "加载中…" : "加载更多"}
                  </button>
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <div className="empty">
            <span className="empty__icon">
              <Icon name="folder" size={22} />
            </span>
            <div className="empty__title">{foldersLoading ? "正在读取收藏夹" : "还没有收藏夹"}</div>
            <p className="empty__text">
              先在哔哩哔哩里创建或收藏一些视频，再回来刷新。也可以稍后重试。
            </p>
          </div>
        )
      ) : null}

      {qr ? (
        <Modal
          title="扫码登录哔哩哔哩"
          subtitle="打开哔哩哔哩手机客户端，扫描下方二维码"
          onClose={() => setQr(null)}
        >
          <div className="biliqr">
            <div className="biliqr__code" dangerouslySetInnerHTML={{ __html: qr.svg }} />
            <p className="biliqr__state" data-state={qrState}>
              {QR_STATE_TEXT[qrState]}
            </p>
            {qrState === "expired" ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => void startLogin()}>
                重新生成二维码
              </button>
            ) : (
              <a className="btn btn--quiet btn--sm" href={qr.url} target="_blank" rel="noreferrer">
                在手机上打开
              </a>
            )}
            <p className="biliqr__hint">
              登录信息只保存在你的服务器上，用于读取收藏夹与下载音频。随时可以退出。
            </p>
          </div>
        </Modal>
      ) : null}

      {video ? (
        <Modal
          title="选择要下载的分 P"
          subtitle={video.title}
          onClose={() => setVideo(null)}
          footer={
            <>
              <span className="lyric__meta">已选 {selected.length} 个</span>
              <div className="lyric__foot-acts">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() =>
                    setSelected(
                      selected.length === video.pages.length
                        ? []
                        : video.pages.map((item) => item.cid),
                    )
                  }
                >
                  {selected.length === video.pages.length ? "取消全选" : "全选"}
                </button>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => void downloadParts()}
                  disabled={selected.length === 0}
                >
                  下载所选
                </button>
              </div>
            </>
          }
        >
          <div className="bili__pages">
            {video.pages.map((item) => (
              <label className="bili__page" key={item.cid}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.cid)}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelected((list) =>
                      checked ? [...list, item.cid] : list.filter((cid) => cid !== item.cid),
                    );
                  }}
                />
                <span className="bili__page-title">
                  P{item.page} · {item.title}
                </span>
                <span className="bili__page-time num">{formatTime(item.duration)}</span>
              </label>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
