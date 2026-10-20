import type { CSSProperties } from "react";
import { formatTime, trackSeed } from "../lib/format";
import { usePlayer } from "../state/PlayerStore";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";

export function PlayerBar() {
  const {
    current,
    playing,
    progress,
    duration,
    volume,
    muted,
    shuffle,
    repeat,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const level = muted ? 0 : volume;

  return (
    <div className="player">
      <div className="player__line">
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="player__inner">
        <div className="player__now">
          {current ? (
            <>
              <Artwork seed={trackSeed(current)} size={44} cover={current.coverUrl} />
              <div className="player__meta">
                <div className="player__title">{current.title}</div>
                <div className="player__artist">{current.artist || "未知艺术家"}</div>
              </div>
            </>
          ) : (
            <span className="player__idle">选一首歌开始播放</span>
          )}
        </div>

        <div className="player__center">
          <div className="player__controls">
            <button
              type="button"
              className="ibtn"
              data-on={shuffle ? "true" : "false"}
              onClick={toggleShuffle}
              aria-label="随机播放"
              title="随机播放"
            >
              <Icon name="shuffle" size={16} />
            </button>
            <button
              type="button"
              className="ibtn"
              onClick={prev}
              disabled={!current}
              aria-label="上一首"
              title="上一首"
            >
              <Icon name="prev" size={17} />
            </button>
            <button
              type="button"
              className="player__play"
              onClick={toggle}
              disabled={!current}
              aria-label={playing ? "暂停" : "播放"}
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
            </button>
            <button
              type="button"
              className="ibtn"
              onClick={next}
              disabled={!current}
              aria-label="下一首"
              title="下一首"
            >
              <Icon name="next" size={17} />
            </button>
            <button
              type="button"
              className="ibtn"
              data-on={repeat === "off" ? "false" : "true"}
              onClick={cycleRepeat}
              aria-label={repeat === "one" ? "单曲循环" : repeat === "all" ? "列表循环" : "循环关闭"}
              title={repeat === "one" ? "单曲循环" : repeat === "all" ? "列表循环" : "循环关闭"}
            >
              <Icon name={repeat === "one" ? "repeat-one" : "repeat"} size={16} />
            </button>
          </div>

          <div className="player__seekrow">
            <span className="player__time num">{formatTime(progress)}</span>
            <input
              className="range"
              type="range"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.5}
              value={Math.min(progress, duration > 0 ? duration : 1)}
              disabled={!current || duration <= 0}
              onChange={(event) => seek(Number(event.currentTarget.value))}
              style={{ "--fill": `${percent}%` } as CSSProperties}
              aria-label="播放进度"
            />
            <span className="player__time num">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player__aux">
          <button
            type="button"
            className="ibtn"
            data-on={muted ? "true" : "false"}
            onClick={toggleMute}
            aria-label={muted ? "取消静音" : "静音"}
            title={muted ? "取消静音" : "静音"}
          >
            <Icon name={muted ? "mute" : "volume"} size={16} />
          </button>
          <div className="player__vol">
            <input
              className="range"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={level}
              onChange={(event) => setVolume(Number(event.currentTarget.value))}
              style={{ "--fill": `${level * 100}%` } as CSSProperties}
              aria-label="音量"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
