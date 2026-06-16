import { useEffect, useRef, useState } from "react";
import { Clock, ChevronDown } from "lucide-react";

import { cn, toFa } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ALL_MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n) => String(n).padStart(2, "0");

/**
 * Custom 24-hour time picker. `value`/`onChange` use a "HH:MM" string. Opens a
 * popover with two scrollable columns (hours / minutes); the selected cell is
 * highlighted and scrolled into view. Replaces the browser's native AM/PM wheel.
 * `minuteStep` controls minute granularity (default 5).
 */
export default function TimeField({ value = "00:00", onChange, disabled, minuteStep = 5 }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const hourColRef = useRef(null);
  const minColRef = useRef(null);

  const [hRaw, mRaw] = String(value).split(":");
  const h = Number(hRaw) || 0;
  const m = Number(mRaw) || 0;

  const minutes = minuteStep > 1 ? ALL_MINUTES.filter((x) => x % minuteStep === 0) : ALL_MINUTES;
  const minute = minutes.includes(m) ? m : minutes.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), 0);

  const set = (hh, mm) => onChange?.(`${pad(hh)}:${pad(mm)}`);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Center the selected cell in each column when opening (without scrolling the page).
  useEffect(() => {
    if (!open) return;
    const center = (col) => {
      const el = col?.querySelector("[data-selected='true']");
      if (el && col) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.clientHeight / 2;
    };
    center(hourColRef.current);
    center(minColRef.current);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-sm transition-colors",
          open ? "border-primary ring-2 ring-ring ring-offset-1" : "border-input hover:border-primary/60",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-bold tabular-nums" dir="ltr">
            {toFa(pad(h))}:{toFa(pad(minute))}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-card shadow-soft-lg">
          <div className="grid grid-cols-2 divide-x divide-border" dir="ltr">
            <Column colRef={hourColRef} label="ساعت" items={HOURS} selected={h} onPick={(x) => set(x, minute)} />
            <Column colRef={minColRef} label="دقیقه" items={minutes} selected={minute} onPick={(x) => set(h, x)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ colRef, label, items, selected, onPick }) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-border bg-muted/40 py-1.5 text-center text-[11px] font-bold text-muted-foreground">
        {label}
      </div>
      <div ref={colRef} className="h-44 overflow-y-auto p-1">
        {items.map((x) => {
          const sel = x === selected;
          return (
            <button
              key={x}
              type="button"
              data-selected={sel}
              onClick={() => onPick(x)}
              className={cn(
                "mb-0.5 w-full rounded-md py-1.5 text-center text-sm tabular-nums transition-colors",
                sel ? "bg-primary font-bold text-primary-foreground" : "hover:bg-accent"
              )}
            >
              {toFa(pad(x))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
