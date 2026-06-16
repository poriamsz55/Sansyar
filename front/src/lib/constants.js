// Persian labels for the backend enums. Keys mirror the Go constants exactly
// (internal/booking, internal/venue, internal/auth) so the UI stays in sync.

// Number of digits in the SMS OTP. Must match the backend OTP_CODE_LENGTH.
export const OTP_LENGTH = Number(import.meta.env.VITE_OTP_LENGTH) || 5;

export const ROLE = {
  super_admin: "مدیر ارشد",
  venue_owner: "مالک مجموعه",
  venue_manager: "مدیر سالن",
  staff: "کارمند",
  customer: "مشتری",
};

export const COMPLEX_STATUS = {
  draft: { label: "پیش‌نویس", tone: "muted" },
  pending_approval: { label: "در انتظار تأیید", tone: "warning" },
  approved: { label: "تأیید شده", tone: "success" },
  published: { label: "منتشر شده", tone: "primary" },
  rejected: { label: "رد شده", tone: "destructive" },
  suspended: { label: "غیرفعال", tone: "muted" },
  // Synthetic status: a live complex whose staged edits await re-approval.
  pending_reapproval: { label: "در انتظار تأیید تغییرات", tone: "warning" },
};

/** Badge status for a complex; staged edits surface as pending_reapproval. */
export const complexDisplayStatus = (c) =>
  c?.pending_changes ? "pending_reapproval" : c?.status;

/** A moderated complex can never be hard-deleted, only deactivated. */
export const complexModerated = (c) =>
  ["approved", "published", "suspended"].includes(c?.status);

/**
 * Staged edits awaiting re-approval take precedence over live values when the
 * edit form re-opens, so the editor continues from their latest proposal.
 */
export function mergePendingChanges(c) {
  const p = c?.pending_changes;
  if (!p) return c;
  const merged = { ...c };
  for (const [key, value] of Object.entries(p)) {
    if (key === "submitted_at") continue;
    if (value !== "" && value != null) merged[key] = value;
  }
  return merged;
}

export const HALL_STATUS = {
  pending_approval: { label: "در انتظار تأیید", tone: "warning" },
  approved: { label: "تأیید شده", tone: "success" },
  published: { label: "منتشر شده", tone: "primary" },
  rejected: { label: "رد شده", tone: "destructive" },
};

export const SLOT_STATUS = {
  available: { label: "آزاد", tone: "success" },
  reserved: { label: "رزرو شده", tone: "muted" },
  blocked: { label: "مسدود", tone: "destructive" },
  closed: { label: "تعطیل", tone: "muted" },
  holiday: { label: "تعطیل رسمی", tone: "warning" },
  special_event: { label: "رویداد ویژه", tone: "primary" },
  maintenance: { label: "تعمیرات", tone: "warning" },
  expired: { label: "منقضی", tone: "muted" },
};

// Booking fill level derived from booked_count vs capacity (see lib/sessions.js).
export const SESSION_FILL = {
  available: { label: "خالی", tone: "success" },
  partial: { label: "نیمه‌پر", tone: "warning" },
  full: { label: "تکمیل", tone: "destructive" },
};

export const BOOKING_STATUS = {
  pending: { label: "در انتظار", tone: "warning" },
  awaiting_payment: { label: "در انتظار پرداخت", tone: "warning" },
  confirmed: { label: "تأیید شده", tone: "success" },
  cancelled_by_user: { label: "لغو شده توسط شما", tone: "destructive" },
  cancelled_by_owner: { label: "لغو شده توسط مجموعه", tone: "destructive" },
  expired: { label: "منقضی", tone: "muted" },
  completed: { label: "انجام شده", tone: "primary" },
  no_show: { label: "عدم حضور", tone: "destructive" },
  refunded: { label: "بازپرداخت شده", tone: "muted" },
  partially_refunded: { label: "بازپرداخت جزئی", tone: "muted" },
};

export const PAYMENT_TYPE = {
  full_online: "پرداخت کامل آنلاین",
  deposit_online_remaining_in_person: "بیعانه آنلاین + باقی در محل",
  full_in_person: "پرداخت کامل در محل",
  wallet: "کیف پول",
  mixed: "ترکیبی",
};

export const PAYMENT_STATUS = {
  unpaid: { label: "پرداخت‌نشده", tone: "warning" },
  paid: { label: "پرداخت‌شده", tone: "success" },
  deposit_paid: { label: "بیعانه پرداخت‌شده", tone: "primary" },
  pay_at_venue: { label: "پرداخت در محل", tone: "muted" },
  failed: { label: "ناموفق", tone: "destructive" },
  refunded: { label: "بازپرداخت‌شده", tone: "muted" },
  partially_refunded: { label: "بازپرداخت جزئی", tone: "muted" },
};

export const SPORTS = [
  { id: "sport-futsal", name: "فوتسال", slug: "futsal" },
  { id: "sport-football", name: "فوتبال", slug: "football" },
  { id: "sport-volleyball", name: "والیبال", slug: "volleyball" },
  { id: "sport-basketball", name: "بسکتبال", slug: "basketball" },
  { id: "sport-tennis", name: "تنیس", slug: "tennis" },
];

export const CITIES = ["تهران", "کرج", "اصفهان", "مشهد", "شیراز", "تبریز"];

// All 31 Iranian provinces (استان‌ها). Used as the offline fallback for the
// province picker; the live list comes from the backend GET /provinces.
export const IRAN_PROVINCES = [
  "تهران",
  "البرز",
  "اصفهان",
  "فارس",
  "خراسان رضوی",
  "آذربایجان شرقی",
  "آذربایجان غربی",
  "اردبیل",
  "بوشهر",
  "چهارمحال و بختیاری",
  "خراسان جنوبی",
  "خراسان شمالی",
  "خوزستان",
  "زنجان",
  "سمنان",
  "سیستان و بلوچستان",
  "کردستان",
  "کرمان",
  "کرمانشاه",
  "کهگیلویه و بویراحمد",
  "گلستان",
  "گیلان",
  "لرستان",
  "مازندران",
  "مرکزی",
  "هرمزگان",
  "همدان",
  "یزد",
  "قم",
  "قزوین",
  "ایلام",
];

export const AMENITIES = [
  "پارکینگ",
  "رختکن",
  "دوش",
  "بوفه",
  "تهویه مطبوع",
  "نور حرفه‌ای",
  "اسکوربرد",
  "تماشاگر",
];
