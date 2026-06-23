import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import { cn, toFa } from "@/lib/utils";
import {
  startOfDay,
  addDays,
  sameDay,
  monthGrid,
  jalaliParts,
  jalaliMonthLabel,
  jalaliDayNum,
  localDateStr,
} from "@/lib/sessions";

const WEEK_HEADS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/** Parse a YYYY-MM-DD string as a local Date (no timezone shift). */
function parseLocal(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** First calendar day of the Jalali month containing `date`. */
function firstOfJalaliMonth(date) {
  let d = startOfDay(date);
  while (jalaliParts(d).jd !== 1) d = addDays(d, -1);
  return d;
}

/**
 * Date picker that renders the Persian (Jalali/Shamsi) calendar while storing a
 * Gregorian "YYYY-MM-DD" string — the wire format every session/holiday/booking
 * endpoint already expects. Drop-in replacement for <input type="date">.
 */
export default function JalaliDatePicker({ value, onChange, disabled, placeholder = "انتخاب تاریخ", className }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseLocal(value), [value]);
  const [viewAnchor, setViewAnchor] = useState(() => selected || startOfDay(new Date()));
  const wrapRef = useRef(null);

  // Re-center the grid on the selected value whenever the popover opens.
  useEffect(() => {
    if (open) setViewAnchor(selected || startOfDay(new Date()));
  }, [open, selected]);

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

  const cells = useMemo(() => monthGrid(viewAnchor), [viewAnchor]);
  const today = startOfDay(new Date());

  const stepMonth = (dir) => {
    const first = firstOfJalaliMonth(viewAnchor);
    setViewAnchor(dir > 0 ? addDays(first, 32) : addDays(first, -1));
  };

  const pick = (date) => {
    onChange?.(localDateStr(date));
    setOpen(false);
  };

  const label = selected
    ? new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" }).format(selected)
    : placeholder;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
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
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={cn("font-medium", !selected && "text-muted-foreground")}>{label}</span>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-soft-lg">
          <div className="mb-2 flex items-center justify-between px-1">
            <button type="button" onClick={() => stepMonth(-1)} className="rounded-md p-1.5 hover:bg-accent" aria-label="ماه قبل">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">{jalaliMonthLabel(viewAnchor)}</span>
            <button type="button" onClick={() => stepMonth(1)} className="rounded-md p-1.5 hover:bg-accent" aria-label="ماه بعد">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
            {WEEK_HEADS.map((d) => (
              <div key={d} className="py-1 font-bold">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(({ date, inMonth }) => {
              const isSel = selected && sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => pick(date)}
                  className={cn(
                    "rounded-md py-1.5 text-center text-sm tabular-nums transition-colors",
                    !inMonth && "text-muted-foreground/40",
                    isSel ? "bg-primary font-bold text-primary-foreground" : "hover:bg-accent",
                    isToday && !isSel && "ring-1 ring-primary/50"
                  )}
                >
                  {jalaliDayNum(date)}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <button type="button" onClick={() => pick(today)} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent">
              امروز
            </button>
            <span className="px-2 py-1 text-[11px] text-muted-foreground" dir="ltr">
              {value ? toFa(value) : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
