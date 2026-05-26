// Persian labels for the backend enums. Keys mirror the Go constants exactly
// (internal/booking, internal/venue, internal/auth) so the UI stays in sync.

export const ROLE = {
  super_admin: "مدیر کل",
  venue_owner: "مدیر مجموعه",
  venue_manager: "مدیر سالن",
  staff: "کارمند",
  customer: "کاربر",
};

export const COMPLEX_STATUS = {
  draft: { label: "پیش‌نویس", tone: "muted" },
  pending_approval: { label: "در انتظار تأیید", tone: "warning" },
  approved: { label: "تأیید شده", tone: "success" },
  rejected: { label: "رد شده", tone: "destructive" },
  suspended: { label: "تعلیق شده", tone: "destructive" },
};

export const SLOT_STATUS = {
  available: { label: "آزاد", tone: "success" },
  reserved: { label: "رزرو شده", tone: "muted" },
  blocked: { label: "مسدود", tone: "destructive" },
  maintenance: { label: "تعمیرات", tone: "warning" },
  expired: { label: "منقضی", tone: "muted" },
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

export const SPORTS = [
  { id: "sport-futsal", name: "فوتسال", slug: "futsal" },
  { id: "sport-football", name: "فوتبال", slug: "football" },
  { id: "sport-volleyball", name: "والیبال", slug: "volleyball" },
  { id: "sport-basketball", name: "بسکتبال", slug: "basketball" },
  { id: "sport-tennis", name: "تنیس", slug: "tennis" },
];

export const CITIES = ["تهران", "کرج", "اصفهان", "مشهد", "شیراز", "تبریز"];

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
