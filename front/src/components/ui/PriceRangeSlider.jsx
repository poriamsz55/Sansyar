import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn, toFa } from "@/lib/utils";

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function snap(n, step) {
  return Math.round(n / step) * step;
}

function faMoney(n) {
  return toFa(Math.round(Number(n) || 0).toLocaleString("en-US"));
}

/**
 * Dual-thumb price range. The track is the main control; compact number
 * fields stay in sync for typing an exact Toman amount.
 */
export function PriceRangeSlider({
  min = 0,
  max = 500000,
  step = 10000,
  value,
  onChange,
  onCommit,
  unit = "تومان",
  className,
}) {
  const id = useId();
  const [lo, hi] = value;
  const [editing, setEditing] = useState(null); // "min" | "max" | null
  const [draft, setDraft] = useState("");
  const [active, setActive] = useState("max");

  const span = max - min || 1;
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;

  function emit(nextLo, nextHi, commit) {
    let a = snap(clamp(nextLo, min, nextHi), step);
    let b = snap(clamp(nextHi, nextLo, max), step);
    a = clamp(a, min, b);
    b = clamp(b, a, max);
    onChange?.([a, b]);
    if (commit) onCommit?.([a, b]);
  }

  function fromInput(which, raw, commit) {
    const parsed = Number(String(raw).replace(/[^\d]/g, ""));
    if (!Number.isFinite(parsed)) return;
    if (which === "min") emit(parsed, hi, commit);
    else emit(lo, parsed, commit);
  }

  function startEdit(which) {
    setEditing(which);
    setDraft(String(which === "min" ? lo : hi));
  }

  function finishEdit(commit) {
    if (editing) fromInput(editing, draft, commit);
    setEditing(null);
  }

  const field = (which) => {
    const current = which === "min" ? lo : hi;
    const isEdit = editing === which;
    return (
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] text-muted-foreground">
          {which === "min" ? "حداقل" : "حداکثر"}
        </span>
        {isEdit ? (
          <Input
            autoFocus
            dir="ltr"
            inputMode="numeric"
            className="h-9 px-2 text-center tnum"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finishEdit(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setEditing(null);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => startEdit(which)}
            className="h-9 rounded-lg border border-input bg-card px-2 text-center text-sm font-semibold tnum transition-colors hover:border-primary/50"
          >
            {faMoney(current)}
          </button>
        )}
      </label>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-center text-sm font-semibold text-navy">
        از {faMoney(lo)} تا {faMoney(hi)}
        <span className="mr-1 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>

      <div className="px-1" dir="ltr">
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
          />
          <input
            id={`${id}-min`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={lo}
            aria-label="حداقل قیمت"
            className="price-range-input absolute inset-0 w-full"
            style={{ zIndex: active === "min" ? 4 : 2 }}
            onPointerDown={() => setActive("min")}
            onChange={(e) => emit(Number(e.target.value), hi, false)}
            onPointerUp={(e) => emit(Number(e.currentTarget.value), hi, true)}
            onKeyUp={(e) => emit(Number(e.currentTarget.value), hi, true)}
          />
          <input
            id={`${id}-max`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={hi}
            aria-label="حداکثر قیمت"
            className="price-range-input absolute inset-0 w-full"
            style={{ zIndex: active === "max" ? 4 : 3 }}
            onPointerDown={() => setActive("max")}
            onChange={(e) => emit(lo, Number(e.target.value), false)}
            onPointerUp={(e) => emit(lo, Number(e.currentTarget.value), true)}
            onKeyUp={(e) => emit(lo, Number(e.currentTarget.value), true)}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{faMoney(min)}</span>
          <span>{faMoney(max)}</span>
        </div>
      </div>

      <div className="flex items-end gap-2">
        {field("min")}
        <span className="mb-2 text-xs text-muted-foreground">تا</span>
        {field("max")}
      </div>
    </div>
  );
}
