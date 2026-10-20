import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Tone = "info" | "error";

type ToastItem = { id: number; message: string; tone: Tone };

type ToastValue = {
  push: (message: string, tone?: Tone) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

let sequence = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: Tone = "info") => {
    sequence += 1;
    const id = sequence;
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setItems((list) => list.filter((item) => item.id !== id));
    }, 3400);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={item.tone === "error" ? "toast toast--error" : "toast"}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
