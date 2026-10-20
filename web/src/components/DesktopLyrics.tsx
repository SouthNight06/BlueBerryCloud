import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { activeLineIndex, parseLrc } from "../lib/lrc";
import { useLyric } from "../lib/useLyric";
import { usePlayer } from "../state/PlayerStore";
import { useUi } from "../state/UiStore";
import { Icon } from "./Icon";

const POS_KEY = "xiaoyun.desktopLyrics.pos";
const DEFAULT_HEIGHT = 176;

type Position = { x: number; y: number };

function readPosition(): Position | null {
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return null;
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function clampPosition(value: Position, width: number): Position {
  const maxX = Math.max(8, window.innerWidth - width - 12);
  const maxY = Math.max(8, window.innerHeight - DEFAULT_HEIGHT - 100);
  return {
    x: Math.min(Math.max(8, value.x), maxX),
    y: Math.min(Math.max(8, value.y), maxY),
  };
}

export function DesktopLyrics() {
  const { current, progress, duration } = usePlayer();
  const { desktopLyrics, setDesktopLyrics, openLyrics } = useUi();
  const { lyric } = useLyric(current?.id ?? null);

  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ dx: number; dy: number; width: number } | null>(null);
  const [position, setPosition] = useState<Position | null>(readPosition);

  const parsed = useMemo(() => parseLrc(lyric?.lrc ?? ""), [lyric]);
  const index = activeLineIndex(parsed.lines, progress);
  const active = index >= 0 ? parsed.lines[index] : null;
  const next = index >= 0 ? parsed.lines[index + 1] : parsed.lines[0];
  const previous = index > 0 ? parsed.lines[index - 1] : null;

  const ratio = useMemo(() => {
    if (!active) return 0;
    const end = next ? next.time : duration > 0 ? duration : active.time + 6;
    const span = Math.max(0.6, end - active.time);
    return Math.min(1, Math.max(0, (progress - active.time) / span));
  }, [active, next, duration, progress]);

  useEffect(() => {
    if (!position) return;
    try {
      window.localStorage.setItem(POS_KEY, JSON.stringify(position));
    } catch {
      /* storage unavailable — position stays for this session */
    }
  }, [position]);

  useEffect(() => {
    const onResize = () => {
      setPosition((value) => (value ? clampPosition(value, cardRef.current?.offsetWidth ?? 520) : value));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragRef.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      width: rect.width,
    };
    setPosition({ x: rect.left, y: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition(
      clampPosition(
        { x: event.clientX - drag.dx, y: event.clientY - drag.dy },
        drag.width,
      ),
    );
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  if (!desktopLyrics || !current) return null;

  const style: CSSProperties = {
    ...(position
      ? { left: `${position.x}px`, top: `${position.y}px`, transform: "none" }
      : { left: "50%", bottom: "calc(var(--player-h) + 22px)", transform: "translateX(-50%)" }),
    ["--p" as string]: `${ratio * 100}%`,
  };

  return (
    <div className="dlyric" style={style} data-synced={parsed.synced ? "true" : "false"}>
      <div className="dlyric__bar">
        <button
          type="button"
          className="dlyric__grab"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="拖动歌词"
          title="拖动歌词"
        >
          <span />
        </button>
        <span className="dlyric__track" title={current.title}>
          {current.title}
        </span>
        <button
          type="button"
          className="ibtn dlyric__act"
          onClick={openLyrics}
          aria-label="歌词与逐字"
          title="歌词与逐字"
        >
          <Icon name="lyrics" size={14} />
        </button>
        <button
          type="button"
          className="ibtn dlyric__act"
          onClick={() => setDesktopLyrics(false)}
          aria-label="关闭桌面歌词"
          title="关闭桌面歌词"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="dlyric__stage">
        <p className="dlyric__side dlyric__side--prev">{previous?.text ?? current.artist}</p>
        {active ? (
          <p key={index} className="dlyric__now">
            {active.text}
          </p>
        ) : (
          <p className="dlyric__now dlyric__now--idle">
            {parsed.synced ? "准备中…" : "暂无歌词"}
          </p>
        )}
        <p className="dlyric__side dlyric__side--next">{next?.text ?? ""}</p>
      </div>
    </div>
  );
}
