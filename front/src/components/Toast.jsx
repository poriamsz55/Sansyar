import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastContext = {
  listeners: new Set(),
  push(message, type = "success") {
    const id = Date.now();
    this.listeners.forEach((fn) => fn({ id, message, type }));
    setTimeout(() => {
      this.listeners.forEach((fn) => fn({ id, dismiss: true }));
    }, 4000);
  },
};

export function toast(message, type = "success") {
  ToastContext.push(message, type);
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function onEvent(event) {
      if (event.dismiss) {
        setItems((prev) => prev.filter((t) => t.id !== event.id));
      } else {
        setItems((prev) => [...prev, event]);
      }
    }
    ToastContext.listeners.add(onEvent);
    return () => ToastContext.listeners.delete(onEvent);
  }, []);

  return (
    <>
      {children}
      {/* Lifted above the mobile bottom navigation bar */}
      <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 z-[100] flex flex-col gap-2 lg:bottom-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-soft-lg",
              t.type === "error"
                ? "bg-destructive text-destructive-foreground"
                : "bg-navy text-white"
            )}
          >
            {t.type === "error" ? (
              <AlertCircle className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span>{t.message}</span>
            <button
              type="button"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="mr-auto opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
