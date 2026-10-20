import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "search"
  | "disc"
  | "list"
  | "swatch"
  | "plus"
  | "play"
  | "pause"
  | "prev"
  | "next"
  | "volume"
  | "mute"
  | "repeat"
  | "repeat-one"
  | "shuffle"
  | "download"
  | "upload"
  | "trash"
  | "check"
  | "close"
  | "edit"
  | "menu"
  | "chevron-down"
  | "chevron-right"
  | "arrow-up"
  | "arrow-down"
  | "cloud"
  | "note"
  | "more"
  | "logout";

const GLYPHS: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.75" />
      <path d="M16.1 16.1 20.5 20.5" />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  list: (
    <>
      <circle cx="4.6" cy="7" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="12" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="17" r="1.05" fill="currentColor" stroke="none" />
      <path d="M8.5 7h11M8.5 12h11M8.5 17h11" />
    </>
  ),
  swatch: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8.4 5.6 18.6 12 8.4 18.4z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="7.6" y="5.4" width="2.9" height="13.2" rx="1.45" fill="currentColor" stroke="none" />
      <rect x="13.5" y="5.4" width="2.9" height="13.2" rx="1.45" fill="currentColor" stroke="none" />
    </>
  ),
  prev: (
    <>
      <path d="M18.4 6.2 9.6 12l8.8 5.8z" fill="currentColor" stroke="none" />
      <rect x="5.2" y="6" width="2.1" height="12" rx="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  next: (
    <>
      <path d="M5.6 6.2 14.4 12 5.6 17.8z" fill="currentColor" stroke="none" />
      <rect x="16.7" y="6" width="2.1" height="12" rx="1.05" fill="currentColor" stroke="none" />
    </>
  ),
  volume: (
    <>
      <path d="M4.2 9.4h3.1L12 5.8v12.4L7.3 14.6H4.2z" />
      <path d="M15.4 9.2a4 4 0 0 1 0 5.6" />
      <path d="M17.9 6.7a7.5 7.5 0 0 1 0 10.6" />
    </>
  ),
  mute: (
    <>
      <path d="M4.2 9.4h3.1L12 5.8v12.4L7.3 14.6H4.2z" />
      <path d="M15.6 9.8 19.8 14M19.8 9.8 15.6 14" />
    </>
  ),
  repeat: (
    <>
      <path d="M4.4 11.2V9.6a2.6 2.6 0 0 1 2.6-2.6h11.4" />
      <path d="M15.9 4.4 18.6 7l-2.7 2.6" />
      <path d="M19.6 12.8v1.6a2.6 2.6 0 0 1-2.6 2.6H5.6" />
      <path d="M8.1 19.6 5.4 17l2.7-2.6" />
    </>
  ),
  "repeat-one": (
    <>
      <path d="M4.4 11.2V9.6a2.6 2.6 0 0 1 2.6-2.6h11.4" />
      <path d="M15.9 4.4 18.6 7l-2.7 2.6" />
      <path d="M19.6 12.8v1.6a2.6 2.6 0 0 1-2.6 2.6H5.6" />
      <path d="M8.1 19.6 5.4 17l2.7-2.6" />
      <path d="M11.4 10.6 12.6 9.9v4.3" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4.2 6.6h3l2.6 3.3" />
      <path d="M20.4 6.6h-3.6l-8.9 10.8H4.2" />
      <path d="M17.6 4.2 20.4 6.6 17.6 9" />
      <path d="M17.6 14.8 20.4 17.4 17.6 19.8" />
    </>
  ),
  download: (
    <>
      <path d="M12 4.2v11" />
      <path d="M7.6 10.9 12 15.3l4.4-4.4" />
      <path d="M4.8 19.4h14.4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.6V4.6" />
      <path d="M7.6 9 12 4.6 16.4 9" />
      <path d="M4.8 19.4h14.4" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 7.1h14.8" />
      <path d="M9.6 7.1V4.6h4.8v2.5" />
      <path d="M6.7 7.1l.85 12.3h8.9l.85-12.3" />
      <path d="M10.3 10.6v5.6M13.7 10.6v5.6" />
    </>
  ),
  check: <path d="M4.8 12.4 9.4 17 19.2 7.2" />,
  close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
  edit: (
    <>
      <path d="M15.4 4.6l4 4L9.2 18.8H5.2v-4z" />
      <path d="M13.2 6.8l4 4" />
    </>
  ),
  menu: <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />,
  "chevron-down": <path d="M6.4 9.4 12 15 17.6 9.4" />,
  "chevron-right": <path d="M9.4 5.8 15 12l-5.6 6.2" />,
  "arrow-up": <path d="M12 19V5M6.4 10.6 12 5l5.6 5.6" />,
  "arrow-down": <path d="M12 5v14M6.4 13.4 12 19l5.6-5.6" />,
  cloud: (
    <>
      <path d="M7.4 18.4a4.2 4.2 0 0 1 .5-8.37 5.6 5.6 0 0 1 10.7 1.2 4 4 0 0 1-.6 7.17z" />
      <path d="M12 13.2v4.4" />
    </>
  ),
  note: (
    <>
      <path d="M9.8 17.4V5.8l8.4-1.9v11.4" />
      <circle cx="7.4" cy="17.4" r="2.4" />
      <circle cx="15.8" cy="15.3" r="2.4" />
    </>
  ),
  more: (
    <>
      <circle cx="5.6" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.4" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  logout: (
    <>
      <path d="M13.6 8.2V6.4a2 2 0 0 0-2-2H7.4a2 2 0 0 0-2 2v11.2a2 2 0 0 0 2 2h4.2a2 2 0 0 0 2-2v-1.8" />
      <path d="M10.6 12h9.2" />
      <path d="M16.9 9.1 19.8 12l-2.9 2.9" />
    </>
  ),
};

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
} & Omit<SVGProps<SVGSVGElement>, "name" | "width" | "height">;

export function Icon({ name, size = 18, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[name]}
    </svg>
  );
}
