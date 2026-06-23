// Shared client-side validators mirroring the Go backend (pkg/validator). They
// give instant feedback in the owner registration / reset forms; the server
// re-validates everything.

/** Iranian mobile number: 09 followed by nine digits. */
export function isIranMobile(value) {
  return /^09\d{9}$/.test(String(value || "").trim());
}

/**
 * Iranian landline number: leading 0, area code (second digit 1-8, since 09 is
 * mobile), then the subscriber number — 11 digits total. e.g. 021xxxxxxxx.
 */
export function isIranLandline(value) {
  return /^0[1-8]\d{9}$/.test(String(value || "").trim());
}

/** Convert Persian/Arabic-Indic digits in a string to ASCII 0-9. */
export function toEnglishDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

/**
 * Sanitize raw input for an Iranian mobile field: normalize digits, keep only
 * 0-9, and cap at 11 characters (0 + 9xxxxxxxx). Use in onChange so the user
 * cannot type letters, separators, or more than a full mobile number.
 */
export function normalizePhoneInput(value) {
  return toEnglishDigits(value).replace(/\D/g, "").slice(0, 11);
}

/**
 * Canonicalize an Iranian mobile to 09XXXXXXXXX, accepting 09…, +989…, 00989…,
 * and bare 9… forms. Returns "" for empty input and null when it can't be
 * parsed as a mobile number.
 */
export function normalizeMobile(value) {
  const raw = toEnglishDigits(value).replace(/\s|-/g, "");
  if (!raw) return "";
  let d = raw.replace(/^\+/, "");
  if (d.startsWith("0098")) d = "0" + d.slice(4);
  else if (d.startsWith("98") && d.length === 12) d = "0" + d.slice(2);
  else if (d.startsWith("9") && d.length === 10) d = "0" + d;
  return isIranMobile(d) ? d : null;
}

/** Canonicalize an Iranian landline (strip +98/0098). "" empty, null invalid. */
export function normalizeLandline(value) {
  const raw = toEnglishDigits(value).replace(/\s|-/g, "");
  if (!raw) return "";
  let d = raw.replace(/^\+/, "");
  if (d.startsWith("0098")) d = "0" + d.slice(4);
  else if (d.startsWith("98") && d.length === 12) d = "0" + d.slice(2);
  return isIranLandline(d) ? d : null;
}

/** Strip everything but digits and a single leading +, capped to 13 chars. */
export function sanitizeContactInput(value) {
  const hasPlus = String(value || "").trim().startsWith("+");
  const digits = toEnglishDigits(value).replace(/\D/g, "").slice(0, 12);
  return (hasPlus ? "+" : "") + digits;
}

/**
 * Iranian national code (کد ملی): ten digits passing the official check-digit
 * algorithm. Repeated-digit codes are rejected.
 */
export function isIranNationalCode(value) {
  const code = String(value || "").trim();
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(code[i]) * (10 - i);
  const rem = sum % 11;
  const check = Number(code[9]);
  return rem < 2 ? check === rem : check === 11 - rem;
}

/**
 * Password strength on a 0–4 scale plus a label. Minimum acceptable strength
 * for the backend is "letters + digits, length >= 8".
 */
export function passwordStrength(value) {
  const pw = String(value || "");
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  else if (/[a-zA-Z]/.test(pw)) score += 0.5;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(4, Math.round(score));

  const labels = ["خیلی ضعیف", "ضعیف", "متوسط", "خوب", "قوی"];
  return {
    score,
    label: labels[score] || labels[0],
    valid: isStrongPassword(pw),
  };
}

/** Minimum backend requirement: >= 8 chars containing both a letter and a digit. */
export function isStrongPassword(value) {
  const pw = String(value || "");
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /\d/.test(pw);
}
