import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Convert latin digits in a string/number to Persian digits. */
export function toFa(value) {
  return String(value ?? "").replace(/\d/g, (d) => faDigits[Number(d)]);
}

/**
 * Backend prices are stored in Rial (e.g. 2500000). We display Toman, the
 * unit Iranians actually use, with thousands separators and Persian digits.
 */
export function formatToman(rial) {
  const toman = Math.round(Number(rial || 0) / 10);
  return toFa(toman.toLocaleString("en-US"));
}

const faWeekdays = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

/** Persian (Jalali) date label, e.g. "۵ خرداد ۱۴۰۵". */
export function formatJalaliDate(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Local-timezone calendar date as "YYYY-MM-DD", using the same timezone
 * resolution Intl.DateTimeFormat applies for formatJalaliDate/Weekday above.
 * Used to group sessions by day so the bucket a session appears under always
 * matches the date shown once it's selected (a raw ISO-string date slice is
 * a UTC date and can disagree with the local date near midnight).
 */
export function localDateKey(iso) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return String(iso).slice(0, 10);
  }
}

export function formatJalaliWeekday(iso) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(
      new Date(iso)
    );
  } catch {
    return faWeekdays[0];
  }
}

/** "۱۸:۳۰" time label. */
export function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatTimeRange(startIso, endIso) {
  return `${formatTime(startIso)} تا ${formatTime(endIso)}`;
}
