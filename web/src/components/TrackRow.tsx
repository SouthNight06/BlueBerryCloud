import type { ReactNode } from "react";
import { formatTime, trackSeed } from "../lib/format";
import { Artwork } from "./Artwork";
import { Icon } from "./Icon";

export type TrackRowData = {
  id?: number;
  title: string;
  artist: string;
  album: string;
  duration: number | null;
  source: string;
  sourceId: string | null;
};

type TrackRowProps = {
  track: TrackRowData;
  position: number;
  active: boolean;
  playing: boolean;
  onPlay: () => void;
  actions?: ReactNode;
};

export function TrackRow({ track, position, active, playing, onPlay, actions }: TrackRowProps) {
  const meta = [track.artist, track.album].filter(Boolean).join(" · ") || "未知信息";

  return (
    <div className="row" data-active={active ? "true" : "false"}>
      <button
        type="button"
        className="row__main"
        onClick={onPlay}
        aria-label={`播放 ${track.title}`}
      >
        <span className="row__pos num">{position}</span>
        <span className="row__art">
          <Artwork seed={trackSeed(track)} size={46} />
          <span className="row__play">
            <Icon name={active && playing ? "pause" : "play"} size={16} />
          </span>
        </span>
        <span className="row__body">
          <span className="row__title">{track.title}</span>
          <span className="row__meta">{meta}</span>
        </span>
        <span className="row__time num">{formatTime(track.duration)}</span>
      </button>
      {actions ? <div className="row__acts">{actions}</div> : null}
    </div>
  );
}
