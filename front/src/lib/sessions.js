// Calendar math and visual helpers for the owner session manager. Dates are
// handled as native Date objects in the browser's local zone (≈ Asia/Tehran);
// labels use the Persian (Jalali) calendar via Intl, matching lib/utils.js.

import { toFa } from "./utils";

export const DAY_START_HOUR = 0; // calendar shows the full 24-hour day
export const DAY_END_HOUR = 24; // exclusive end (midnight)
export const SNAP_MINUTES = 15; // drag snap granularity

// Iranian week starts on Saturday.
export const WEEKDAY_LABELS = [
  "شنبه",
  "یک‌شنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنج‌شنبه",
  "جمعه",
];

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Saturday on or before `date` (start of the Iranian week). */
export function startOfWeek(date) {
  const d = startOfDay(date);
  const offset = (d.getDay() + 1) % 7; // Sat→0, Sun→1 … Fri→6
  return addDays(d, -offset);
}

/** The seven Date objects for the week containing `date` (Sat … Fri). */
export function weekDays(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// ---- Jalali helpers --------------------------------------------------------

const jalaliFmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function jalaliParts(date) {
  const parts = jalaliFmt.formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { jy: get("year"), jm: get("month"), jd: get("day") };
}

/** Persian day-of-month number, e.g. "۵". */
export function jalaliDayNum(date) {
  return toFa(jalaliParts(date).jd);
}

/** "خرداد ۱۴۰۵". */
export function jalaliMonthLabel(date) {
  return new Intl.DateTimeFormat("fa-IR", { month: "long", year: "numeric" }).format(date);
}

/** Range label for a week, e.g. "۱ تا ۷ خرداد". */
export function jalaliRangeLabel(start, end) {
  const s = new Intl.DateTimeFormat("fa-IR", { day: "numeric" }).format(start);
  const e = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" }).format(end);
  return `${s} تا ${e}`;
}

/**
 * Six-week grid (42 cells) covering the Jalali month of `date`, each cell
 * flagged whether it belongs to that month.
 */
export function monthGrid(date) {
  const { jm } = jalaliParts(date);
  let first = startOfDay(date);
  while (jalaliParts(first).jd !== 1) first = addDays(first, -1);
  const startCell = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const cell = addDays(startCell, i);
    return { date: cell, inMonth: jalaliParts(cell).jm === jm };
  });
}

// ---- Time / geometry -------------------------------------------------------

export function minutesOfDay(date) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Start-minutes-since-midnight and duration for a session, computed from the
 * real timestamp difference. This keeps the duration positive for sessions that
 * end at 00:00 (next-day midnight), where `minutesOfDay(ends_at)` would be 0.
 */
export function sessionSpan(session) {
  const start = new Date(session.starts_at);
  const end = new Date(session.ends_at);
  const startMin = minutesOfDay(start);
  const durationMin = Math.max(0, Math.round((end - start) / 60000));
  return { startMin, durationMin, endMin: startMin + durationMin };
}

/** Build an ISO timestamp from a local day + minutes-since-midnight. */
export function isoFromLocal(day, minutes) {
  const d = startOfDay(day);
  d.setMinutes(minutes);
  return d.toISOString();
}

export function snap(minutes, step = SNAP_MINUTES) {
  return Math.round(minutes / step) * step;
}

export function clockLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return toFa(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}

// ---- Occupancy / status ----------------------------------------------------

/**
 * A session is reserved/booked (and therefore locked from time changes) when it
 * carries a booking or sits in the reserved/full state.
 */
export function isBooked(session) {
  return (session.booked_count || 0) > 0 || session.status === "reserved" || session.fill === "full";
}

/**
 * A session can't be moved/resized/rescheduled when it is booked or in an
 * operational lock state (closed/blocked).
 */
export function isLocked(session) {
  return isBooked(session) || session.status === "closed" || session.status === "blocked";
}

/**
 * Binary occupancy: a session holds at most one booking, so it is either
 * available or fully booked (no per-session capacity any more).
 */
export function occupancy(session) {
  const booked = isBooked(session) ? 1 : 0;
  const fill = booked ? "full" : "available";
  return { booked, remaining: 1 - booked, fill, pct: booked ? 100 : 0 };
}

export function revenueEstimate(session) {
  if (typeof session.revenue_estimate === "number") return session.revenue_estimate;
  return (session.booked_count || 0) * (session.final_price || 0);
}

/**
 * Tailwind classes for a session block. Operational states (closed/holiday/…)
 * win over booking fill; otherwise color follows occupancy.
 */
export function sessionColors(session) {
  switch (session.status) {
    case "closed":
    case "blocked":
      return { block: "bg-slate-200 border-slate-300 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300", bar: "bg-slate-400" };
    case "maintenance":
      return { block: "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200", bar: "bg-orange-400" };
    case "holiday":
      return { block: "bg-violet-100 border-violet-300 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200", bar: "bg-violet-400" };
    case "special_event":
      return { block: "bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200", bar: "bg-indigo-400" };
    default:
      break;
  }
  const { fill } = occupancy(session);
  if (fill === "full") return { block: "bg-rose-100 border-rose-300 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200", bar: "bg-rose-500" };
  if (fill === "partial") return { block: "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200", bar: "bg-amber-500" };
  return { block: "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200", bar: "bg-emerald-500" };
}

export const STATUS_LEGEND = [
  { key: "available", label: "آزاد", dot: "bg-emerald-500" },
  { key: "full", label: "رزرو شده", dot: "bg-rose-500" },
  { key: "closed", label: "تعطیل", dot: "bg-slate-400" },
  { key: "holiday", label: "تعطیل رسمی", dot: "bg-violet-400" },
  { key: "maintenance", label: "تعمیرات", dot: "bg-orange-400" },
  { key: "special_event", label: "ویژه", dot: "bg-indigo-400" },
];

/** YYYY-MM-DD in local time (for backend date params). */
export function localDateStr(date) {
  const d = startOfDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
