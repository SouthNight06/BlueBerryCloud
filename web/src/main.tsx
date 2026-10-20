import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { isNativeApp, syncApiBase } from "./api/client";
import { ToastProvider } from "./state/ToastStore";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/app.css";

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root container");

const root = createRoot(container);

function render() {
  root.render(
    <StrictMode>
      <ToastProvider>
        <App />
      </ToastProvider>
    </StrictMode>,
  );
}

async function boot() {
  const deadline = new Promise<void>((resolve) => window.setTimeout(resolve, 1400));
  await Promise.race([syncApiBase().catch(() => undefined), deadline]);
  render();
}

void boot();

if (import.meta.env.PROD && !isNativeApp() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
