export const LOCAL_MODE = (import.meta.env.VITE_LOCAL_MODE ?? "").trim() === "1";

export const APP_TITLE = LOCAL_MODE ? "小云畅听 · 本地版" : "小云畅听";
