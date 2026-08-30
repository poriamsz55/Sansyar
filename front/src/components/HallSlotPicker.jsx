import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Percent, Sparkles } from "lucide-react";

import { SlotChip } from "@/components/SlotChip";
import { isSlotInTheFuture } from "@/lib/reservation";
import {
  addDays,
  jalaliDayNum,
  jalaliMonthLabel,
  jalaliParts,
  localDateStr,
  monthGrid,
  sameDay,
  startOfDay,
  startOfWeek,
} from "@/lib/sessions";
import { cn, formatJalaliDate, formatJalaliWeekday, toFa } from "@/lib/utils";

const WEEK_HEADS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const TIME_BANDS = [
  { id: "all", label: "همه ساعات" },
  { id: "morning", label: "صبح", hint: "۶–۱۲", test: (h) => h >= 6 && h < 12 },
  { id: "noon", label: "ظهر", hint: "۱۲–۱۶", test: (h) => h >= 12 && h < 16 },
  { id: "evening", label: "عصر", hint: "۱۶–۲۰", test: (h) => h >= 16 && h < 20 },
  { id: "night", label: "شب", hint: "۲۰–۶", test: (h) => h >= 20 || h < 6 },
];

function parseDay(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return startOfDay(new Date());
  return new Date(y, m - 1, d);
}

function firstOfJalaliMonth(date) {
  let d = startOfDay(date);
  while (jalaliParts(d).jd !== 1) d = addDays(d, -1);
  return d;
}

function slotHour(slot) {
  return new Date(slot.starts_at).getHours();
}

function isAvailable(slot) {
  return slot.status === "available";
}

/**
 * Month-calendar + filters for picking a hall session. Lets the customer browse
 * every scheduled day (not just a handful of chips), jump by today/week/month,
 * and narrow by time of day or discount.
 */
export function HallSlotPicker({ slots, selectedId, onSelect }) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const bookableSlots = useMemo(
    () => slots.filter((s) => isSlotInTheFuture(s) && s.status !== "expired"),
    [slots]
  );

  const byDay = useMemo(() => {
    const map = new Map();
    for (const s of bookableSlots) {
      const key = localDateStr(new Date(s.starts_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    for (const items of map.values()) {
      items.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    }
    return map;
  }, [bookableSlots]);

  const dayKeys = useMemo(
    () => [...byDay.keys()].sort((a, b) => a.localeCompare(b)),
    [byDay]
  );

  const firstUpcomingKey = useMemo(() => {
    const todayKey = localDateStr(today);
    return dayKeys.find((k) => k >= todayKey) || dayKeys[0] || todayKey;
  }, [dayKeys, today]);

  const [activeKey, setActiveKey] = useState(firstUpcomingKey);
  const [viewAnchor, setViewAnchor] = useState(() => parseDay(firstUpcomingKey));
  const [band, setBand] = useState("all");
  const [onlyFree, setOnlyFree] = useState(true);
  const [onlyDiscount, setOnlyDiscount] = useState(false);

  const minMonth = dayKeys.length ? firstOfJalaliMonth(parseDay(dayKeys[0])) : today;
  const maxMonth = dayKeys.length
    ? firstOfJalaliMonth(parseDay(dayKeys[dayKeys.length - 1]))
    : today;

  const cells = useMemo(() => monthGrid(viewAnchor), [viewAnchor]);

  const activeSlots = byDay.get(activeKey) || [];
  const visibleSlots = activeSlots.filter((s) => {
    if (onlyFree && !isAvailable(s)) return false;
    if (onlyDiscount && !(s.discount_percent > 0 && isAvailable(s))) return false;
    if (band === "all") return true;
    const spec = TIME_BANDS.find((b) => b.id === band);
    return spec?.test?.(slotHour(s));
  });

  const monthAvail = useMemo(() => {
    let n = 0;
    for (const { date, inMonth } of cells) {
      if (!inMonth) continue;
      const items = byDay.get(localDateStr(date)) || [];
      n += items.filter(isAvailable).length;
    }
    return n;
  }, [cells, byDay]);

  const bandsWithSlots = useMemo(() => {
    const hours = activeSlots.map(slotHour);
    return new Set(
      TIME_BANDS.filter((b) => b.id === "all" || hours.some((h) => b.test(h))).map((b) => b.id)
    );
  }, [activeSlots]);

  function stepMonth(dir) {
    const first = firstOfJalaliMonth(viewAnchor);
    const next = dir > 0 ? addDays(first, 32) : addDays(first, -1);
    const nextFirst = firstOfJalaliMonth(next);
    if (dir < 0 && nextFirst < minMonth) return;
    if (dir > 0 && nextFirst > maxMonth) return;
    setViewAnchor(nextFirst);
  }

  function selectDay(date) {
    const key = localDateStr(date);
    if (!byDay.has(key)) return;
    if (startOfDay(date) < today) return;
    setActiveKey(key);
    setBand("all");
  }

  function jumpToday() {
    const key = localDateStr(today);
    setViewAnchor(today);
    if (byDay.has(key) && startOfDay(today) >= today) setActiveKey(key);
    else if (firstUpcomingKey) {
      setActiveKey(firstUpcomingKey);
      setViewAnchor(parseDay(firstUpcomingKey));
    }
  }

  function jumpWeek() {
    const start = startOfWeek(today);
    const end = addDays(start, 7);
    const startKey = localDateStr(start);
    const endKey = localDateStr(end);
    const hit = dayKeys.find((k) => k >= startKey && k < endKey && k >= localDateStr(today));
    setViewAnchor(today);
    if (hit) setActiveKey(hit);
  }

  function jumpMonth() {
    setViewAnchor(today);
    const { jy, jm } = jalaliParts(today);
    const todayKey = localDateStr(today);
    const hit = dayKeys.find((k) => {
      if (k < todayKey) return false;
      const p = jalaliParts(parseDay(k));
      return p.jy === jy && p.jm === jm;
    });
    if (hit) setActiveKey(hit);
  }

  const canPrev = firstOfJalaliMonth(viewAnchor) > minMonth;
  const canNext = firstOfJalaliMonth(viewAnchor) < maxMonth;
  const activeDate = parseDay(activeKey);
  const freeOnDay = activeSlots.filter(isAvailable).length;

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <QuickChip onClick={jumpToday}>امروز</QuickChip>
          <QuickChip onClick={jumpWeek}>این هفته</QuickChip>
          <QuickChip onClick={jumpMonth}>این ماه</QuickChip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ToggleChip
            active={onlyFree}
            onClick={() => setOnlyFree((v) => !v)}
          >
            <Sparkles className="h-3 w-3" />
            فقط آزاد
          </ToggleChip>
          <ToggleChip
            active={onlyDiscount}
            onClick={() => setOnlyDiscount((v) => !v)}
          >
            <Percent className="h-3 w-3" />
            تخفیف‌دار
          </ToggleChip>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => stepMonth(-1)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-30"
            aria-label="ماه قبل"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold">{jalaliMonthLabel(viewAnchor)}</p>
            <p className="text-[11px] text-muted-foreground">
              {toFa(monthAvail)} سانس آزاد در این ماه
            </p>
          </div>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => stepMonth(1)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-30"
            aria-label="ماه بعد"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-bold text-muted-foreground">
          {WEEK_HEADS.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map(({ date, inMonth }) => {
            const key = localDateStr(date);
            const items = byDay.get(key) || [];
            const avail = items.filter(isAvailable).length;
            const isPast = startOfDay(date) < today;
            const isSel = key === activeKey;
            const isToday = sameDay(date, today);
            const clickable = items.length > 0 && !isPast;

            return (
              <button
                key={key}
                type="button"
                disabled={!clickable}
                onClick={() => selectDay(date)}
                aria-pressed={isSel}
                aria-label={formatJalaliDate(date)}
                className={cn(
                  "relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                  !inMonth && "opacity-40",
                  isPast && "cursor-not-allowed text-muted-foreground/40",
                  !clickable && !isPast && "cursor-default text-muted-foreground/50",
                  clickable && !isSel && "hover:bg-card",
                  isSel && "bg-primary font-bold text-primary-foreground shadow-soft",
                  isToday && !isSel && "ring-1 ring-primary/40"
                )}
              >
                <span className="tnum leading-none">{jalaliDayNum(date)}</span>
                {items.length > 0 && (
                  <span
                    className={cn(
                      "mt-1 h-1 w-1 rounded-full",
                      isSel
                        ? "bg-primary-foreground"
                        : avail > 0
                          ? "bg-success"
                          : "bg-muted-foreground/50"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> سانس آزاد
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> پر / بسته
          </span>
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold">
              {formatJalaliWeekday(activeDate)} {formatJalaliDate(activeDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {toFa(freeOnDay)} سانس آزاد از {toFa(activeSlots.length)} سانس این روز
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {TIME_BANDS.filter((b) => bandsWithSlots.has(b.id)).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBand(b.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                band === b.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {b.label}
              {b.hint && band === b.id ? ` ${b.hint}` : ""}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeKey}-${band}-${onlyFree}-${onlyDiscount}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {visibleSlots.length > 0 ? (
              visibleSlots.map((slot) => (
                <SlotChip
                  key={slot.id}
                  slot={slot}
                  selected={selectedId === slot.id}
                  onSelect={onSelect}
                />
              ))
            ) : (
              <p className="col-span-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {activeSlots.length === 0
                  ? "در این روز سانسی ثبت نشده است."
                  : "سانسی با این فیلتر در این روز پیدا نشد. فیلتر را عوض کن."}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuickChip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ToggleChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
