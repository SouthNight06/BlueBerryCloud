import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { isNativeApp } from "./api/client";
import { ToastProvider } from "./state/ToastStore";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/app.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container");

createRoot(container).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && !isNativeApp() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
