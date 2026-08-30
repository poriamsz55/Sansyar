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

// Per-session gender restriction (empty/unset = inherits the hall's gender_rule).
export const SLOT_GENDER = {
  male: { label: "آقایان", tone: "primary" },
  female: { label: "بانوان", tone: "primary" },
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
  cancellation_requested: { label: "درخواست لغو (در انتظار تأیید)", tone: "warning" },
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
  dongi: "پرداخت دونگی",
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

export const TICKET_STATUS = {
  open: { label: "باز", tone: "warning" },
  in_progress: { label: "در حال بررسی", tone: "primary" },
  resolved: { label: "حل‌شده", tone: "success" },
  closed: { label: "بسته‌شده", tone: "muted" },
};

export const TICKET_CATEGORY = {
  contact: "پیام عمومی",
  bug: "گزارش باگ",
};

export const SPORTS = [
  { id: "sport-futsal", name: "فوتسال", slug: "futsal" },
  { id: "sport-football", name: "فوتبال", slug: "football" },
  { id: "sport-volleyball", name: "والیبال", slug: "volleyball" },
  { id: "sport-basketball", name: "بسکتبال", slug: "basketball" },
  { id: "sport-tennis", name: "تنیس", slug: "tennis" },
];

// Provincial capitals plus other well-known major cities across all 31
// provinces. Not an exhaustive nationwide list — venue owners enter their own
// city as free text; this only powers the search-page city filter dropdown.
export const CITIES = [
  "تهران",
  "کرج",
  "اصفهان",
  "مشهد",
  "شیراز",
  "تبریز",
  "اهواز",
  "قم",
  "کرمانشاه",
  "ارومیه",
  "رشت",
  "زاهدان",
  "همدان",
  "یزد",
  "اردبیل",
  "بندرعباس",
  "اراک",
  "کرمان",
  "زنجان",
  "سنندج",
  "قزوین",
  "خرم‌آباد",
  "گرگان",
  "ساری",
  "بوشهر",
  "بجنورد",
  "ایلام",
  "یاسوج",
  "شهرکرد",
  "سمنان",
  "بیرجند",
  "شاهرود",
  "نیشابور",
  "سبزوار",
  "تربت حیدریه",
  "کاشان",
  "نجف‌آباد",
  "خمینی‌شهر",
  "شاهین‌شهر",
  "مرودشت",
  "جهرم",
  "کازرون",
  "لار",
  "مراغه",
  "میانه",
  "اهر",
  "مرند",
  "خوی",
  "مهاباد",
  "بوکان",
  "سلماس",
  "دزفول",
  "آبادان",
  "خرمشهر",
  "بندر ماهشهر",
  "اندیمشک",
  "شوشتر",
  "بهبهان",
  "بابل",
  "آمل",
  "قائم‌شهر",
  "بهشهر",
  "نوشهر",
  "چالوس",
  "رامسر",
  "لاهیجان",
  "بندرانزلی",
  "لنگرود",
  "رودسر",
  "آستارا",
  "سیرجان",
  "رفسنجان",
  "بم",
  "جیرفت",
  "اسلام‌آباد غرب",
  "بروجرد",
  "الیگودرز",
  "دورود",
  "میناب",
  "قشم",
  "بندرلنگه",
  "گنبدکاووس",
  "علی‌آباد کتول",
  "گچساران",
];

// Contact number shown in the footer and the "Contact Us" ticket modal.
export const SUPPORT_PHONE = "09058026688";

// Maps a status "tone" (used throughout Badge/StatusBadge) to a chart color,
// so the one chart that legitimately encodes state (reservations by status)
// reuses the same semantics as its badges instead of inventing new hues.
export const TONE_CHART_COLOR = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  destructive: "hsl(var(--destructive))",
  warning: "#f59e0b",
  muted: "hsl(var(--muted-foreground))",
};

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
