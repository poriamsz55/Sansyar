// API surface for Sansyar. Set VITE_USE_MOCK=false to use the Go backend.

import { apiFetch, setToken } from "./client";
import * as mock from "../data/mock";
import { SPORTS, IRAN_PROVINCES } from "../lib/constants";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "false") === "true";

const store = {
  complexes: structuredClone(mock.complexes),
  halls: structuredClone(mock.halls),
  slots: structuredClone(mock.slots),
  bookings: structuredClone(mock.bookings),
};

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

let sportsCache = null;

export async function getSportsMap() {
  if (sportsCache) return sportsCache;
  const sports = await listSports();
  sportsCache = Object.fromEntries(sports.map((s) => [s.id, s.name]));
  return sportsCache;
}

function enrichComplex(c, sportsMap = {}) {
  const sportIds = c.sport_ids || [];
  return {
    ...c,
    sports: sportIds.map((id) => sportsMap[id] || id).filter(Boolean),
  };
}

function normalizeComplexList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items || [];
}

// ---- Auth -----------------------------------------------------------------

export async function login({ phone, password, rememberMe = true }) {
  if (!USE_MOCK) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { phone, password, remember_me: rememberMe },
    });
    setToken(data.access_token, { remember: rememberMe });
    return data.user;
  }
  await delay();
  const users = {
    "09000000000": { id: "user-admin", full_name: "مدیر ارشد", role: "super_admin" },
    "09120000000": { id: "user-owner", full_name: "مالک مجموعه", role: "venue_owner" },
    "09350000000": { id: "user-customer", full_name: "کاربر نمونه", role: "customer" },
  };
  const user = users[phone] || {
    id: "user-customer",
    full_name: "کاربر نمونه",
    phone,
    role: "customer",
  };
  setToken("mock-token");
  return { ...user, phone };
}

// Vendor Admin (venue owner) self-service registration.
export async function registerOwner(payload) {
  if (!USE_MOCK) {
    const data = await apiFetch("/auth/owner/register", {
      method: "POST",
      body: payload,
    });
    setToken(data.access_token, { remember: true });
    return data.user;
  }
  await delay();
  setToken("mock-token");
  return {
    id: "user-owner",
    full_name: `${payload.first_name} ${payload.last_name}`,
    phone: payload.phone,
    role: "venue_owner",
  };
}

// Owner password recovery: request a reset code, then submit it with a new password.
export async function forgotPassword(phone) {
  if (!USE_MOCK) {
    return apiFetch("/auth/password/forgot", { method: "POST", body: { phone } });
  }
  await delay();
  return { message: "reset code sent", expires_in: 120 };
}

export async function resetPassword({ phone, code, newPassword }) {
  if (!USE_MOCK) {
    return apiFetch("/auth/password/reset", {
      method: "POST",
      body: { phone, code, new_password: newPassword },
    });
  }
  await delay();
  return {};
}

// Customer OTP login: request a code, then verify it to obtain a session.
export async function requestOtp(phone) {
  if (!USE_MOCK) {
    return apiFetch("/auth/otp/request", { method: "POST", body: { phone } });
  }
  await delay();
  return { message: "verification code sent", expires_in: 120 };
}

export async function verifyOtp(phone, code) {
  if (!USE_MOCK) {
    const data = await apiFetch("/auth/otp/verify", {
      method: "POST",
      body: { phone, code },
    });
    setToken(data.access_token);
    return data.user;
  }
  return login({ phone });
}

export async function getMe() {
  if (!USE_MOCK) {
    return apiFetch("/me");
  }
  await delay();
  return { id: "user-customer", full_name: "کاربر نمونه", phone: "09350000000", role: "customer" };
}

export async function updateProfile(payload) {
  if (!USE_MOCK) {
    return apiFetch("/me", { method: "PATCH", body: payload });
  }
  await delay();
  return { ...payload };
}

// ---- Public discovery -----------------------------------------------------

export async function listSports() {
  if (!USE_MOCK) return apiFetch("/sports");
  await delay(150);
  return SPORTS;
}

// ---- Sports management (platform admin) ------------------------------------

export async function listAdminSports() {
  if (!USE_MOCK) return apiFetch("/admin/sports");
  await delay(150);
  return SPORTS;
}

export async function createSport(payload) {
  if (!USE_MOCK) return apiFetch("/admin/sports", { method: "POST", body: payload });
  await delay();
  return { id: uid("sport"), is_active: true, ...payload };
}

export async function updateSport(id, payload) {
  if (!USE_MOCK) return apiFetch(`/admin/sports/${id}`, { method: "PATCH", body: payload });
  await delay();
  return { id, ...payload };
}

export async function deleteSport(id) {
  if (!USE_MOCK) return apiFetch(`/admin/sports/${id}`, { method: "DELETE" });
  await delay();
}

let provincesCache = null;
export async function listProvinces() {
  if (provincesCache) return provincesCache;
  if (!USE_MOCK) {
    provincesCache = await apiFetch("/provinces");
    return provincesCache;
  }
  await delay(100);
  provincesCache = IRAN_PROVINCES.map((name, i) => ({ id: `p-${i}`, name }));
  return provincesCache;
}

// listComplexes returns a plain array by default (used by callers like Home
// that just want a quick list). Pass `page`/`limit` to opt into the paginated
// shape `{ items, total, page, limit }`, matching how the backend itself
// switches response shape based on those params.
export async function listComplexes(filters = {}) {
  const paginated = !!(filters.page || filters.limit);
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (filters.city) params.set("city", filters.city);
    if (filters.q) params.set("q", filters.q);
    if (filters.sportId) params.set("sport_id", filters.sportId);
    if (filters.minPrice) params.set("min_price", String(filters.minPrice));
    if (filters.maxPrice) params.set("max_price", String(filters.maxPrice));
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const data = await apiFetch(`/complexes${qs ? `?${qs}` : ""}`);
    const rawItems = normalizeComplexList(data);
    const sportsMap = await getSportsMap();
    const items = rawItems.map((c) =>
      enrichComplex(
        {
          ...c,
          sport_ids: c.sport_ids || [],
          lowest_price: c.lowest_price ?? 0,
          available_slot_count: c.available_slot_count ?? 0,
          discount_percent: c.discount_percent ?? 0,
        },
        sportsMap
      )
    );
    if (paginated) {
      return { items, total: data?.total ?? items.length, page: data?.page ?? filters.page ?? 1, limit: data?.limit ?? filters.limit ?? items.length };
    }
    return items;
  }
  await delay();
  let items = store.complexes.map((c) => enrichComplex(c));
  const { sportId, city, minPrice, maxPrice, q } = filters;
  if (sportId) items = items.filter((c) => c.sport_ids?.includes(sportId));
  if (city) items = items.filter((c) => c.city === city);
  if (minPrice) items = items.filter((c) => c.lowest_price >= minPrice);
  if (maxPrice) items = items.filter((c) => c.lowest_price <= maxPrice);
  if (q)
    items = items.filter(
      (c) =>
        c.name.includes(q) || c.city.includes(q) || c.neighborhood?.includes(q)
    );
  if (paginated) {
    return { items, total: items.length, page: filters.page || 1, limit: filters.limit || items.length };
  }
  return items;
}

// Real platform-wide counts for the homepage stats strip.
export async function getPublicStats() {
  if (!USE_MOCK) return apiFetch("/stats");
  await delay(150);
  return {
    total_venues: store.complexes.length,
    total_reservations: store.bookings.length,
  };
}

// Published venues ranked by reservation count (most-booked first), for the
// homepage's "featured venues" row.
export async function listFeaturedComplexes(limit = 8) {
  if (!USE_MOCK) {
    const data = await apiFetch(`/complexes/featured?limit=${limit}`);
    const sportsMap = await getSportsMap();
    return (Array.isArray(data) ? data : []).map((c) =>
      enrichComplex(
        {
          ...c,
          sport_ids: c.sport_ids || [],
          lowest_price: c.lowest_price ?? 0,
          available_slot_count: c.available_slot_count ?? 0,
          discount_percent: c.discount_percent ?? 0,
        },
        sportsMap
      )
    );
  }
  const items = await listComplexes();
  return items.slice(0, limit);
}

// Total (non-cancelled/expired) reservations for one venue, shown next to its
// name on the details page instead of a rating count.
export async function getComplexBookingCount(id) {
  if (!USE_MOCK) {
    const data = await apiFetch(`/complexes/${id}/booking-count`);
    return data?.booking_count ?? 0;
  }
  await delay(100);
  return store.bookings.filter((b) => b.complex_id === id).length;
}

export async function getComplex(id) {
  if (!USE_MOCK) {
    const c = await apiFetch(`/complexes/${id}`);
    const sportsMap = await getSportsMap();
    return enrichComplex(
      {
        ...c,
        sport_ids: c.sport_ids || [],
      },
      sportsMap
    );
  }
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  return c ? enrichComplex(c) : null;
}

export async function listHalls(complexId, { includeInactive = false } = {}) {
  if (!USE_MOCK) {
    const path = includeInactive
      ? `/owner/complexes/${complexId}/halls?include_inactive=true`
      : `/complexes/${complexId}/halls`;
    return apiFetch(path);
  }
  await delay();
  return store.halls.filter(
    (h) => h.complex_id === complexId && (includeInactive || h.is_active !== false)
  );
}

export async function getHall(id) {
  if (!USE_MOCK) return apiFetch(`/halls/${id}`);
  await delay();
  return store.halls.find((h) => h.id === id) || null;
}

export async function listSlots({ hallId, complexId, status, date } = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (complexId) params.set("complex_id", complexId);
    if (status) params.set("status", status);
    if (date) params.set("date", date);
    const qs = params.toString();
    if (hallId) return apiFetch(`/halls/${hallId}/slots${qs ? `?${qs}` : ""}`);
    return apiFetch(`/slots${qs ? `?${qs}` : ""}`);
  }
  await delay(200);
  let items = store.slots;
  if (hallId) items = items.filter((s) => s.hall_id === hallId);
  if (complexId) items = items.filter((s) => s.complex_id === complexId);
  return items;
}

// ---- Customer bookings ----------------------------------------------------

export async function createBooking({ slot_id, payment_type }) {
  if (!USE_MOCK) {
    return apiFetch("/bookings", {
      method: "POST",
      body: { slot_id, payment_type },
      headers: { "Idempotency-Key": uid("idem") },
    });
  }
  await delay();
  const slot = store.slots.find((s) => s.id === slot_id);
  if (!slot) throw new Error("سانس یافت نشد");
  slot.status = "reserved";
  const booking = {
    id: uid("booking"),
    customer_id: "user-customer",
    complex_id: slot.complex_id,
    hall_id: slot.hall_id,
    sport_id: slot.sport_id,
    slot_id: slot.id,
    starts_at: slot.starts_at,
    ends_at: slot.ends_at,
    price: slot.base_price,
    discount: slot.discount_percent,
    final_amount: slot.final_price,
    payment_type,
    payment_status: payment_type === "full_in_person" ? "unpaid" : "paid",
    status: "confirmed",
    created_at: new Date().toISOString(),
  };
  store.bookings.unshift(booking);
  return booking;
}

export async function myBookings() {
  if (!USE_MOCK) return apiFetch("/my/bookings");
  await delay();
  return store.bookings.filter((b) => b.customer_id === "user-customer");
}

export async function cancelBooking(id) {
  if (!USE_MOCK) return apiFetch(`/bookings/${id}/cancel`, { method: "POST" });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) {
    b.status = "cancelled_by_user";
    const slot = store.slots.find((s) => s.id === b.slot_id);
    if (slot) slot.status = "available";
  }
  return b;
}

// ---- Owner / Admin complexes & halls --------------------------------------

export async function listOwnerComplexes(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams(filters);
    const qs = params.toString();
    return normalizeComplexList(await apiFetch(`/owner/complexes${qs ? `?${qs}` : ""}`));
  }
  return listComplexes(filters);
}

export async function listAdminComplexes(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams(filters);
    const qs = params.toString();
    return normalizeComplexList(await apiFetch(`/admin/complexes${qs ? `?${qs}` : ""}`));
  }
  return store.complexes;
}

export async function createComplex(payload) {
  if (!USE_MOCK)
    return apiFetch("/owner/complexes", { method: "POST", body: payload });
  await delay();
  const complex = {
    id: uid("complex"),
    owner_id: "user-owner",
    status: "pending_approval",
    rating_avg: 0,
    rating_count: 0,
    images: payload.images || [],
    amenities: payload.amenities || [],
    rules: payload.rules || [],
    available_slot_count: 0,
    discount_percent: 0,
    lowest_price: payload.lowest_price || 0,
    ...payload,
  };
  store.complexes.unshift(complex);
  return complex;
}

export async function updateComplex(id, payload) {
  if (!USE_MOCK)
    return apiFetch(`/owner/complexes/${id}`, { method: "PATCH", body: payload });
  await delay();
  const idx = store.complexes.findIndex((c) => c.id === id);
  if (idx >= 0) store.complexes[idx] = { ...store.complexes[idx], ...payload };
  return store.complexes[idx];
}

export async function deleteComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/owner/complexes/${id}`, { method: "DELETE" });
  await delay();
  const idx = store.complexes.findIndex((c) => c.id === id);
  if (idx < 0) return;
  // Mirror the backend: moderated complexes are deactivated, the rest are
  // removed permanently.
  if (["approved", "published", "suspended"].includes(store.complexes[idx].status)) {
    store.complexes[idx].status = "suspended";
  } else {
    store.complexes.splice(idx, 1);
  }
}

export async function approveComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/approve`, { method: "POST" });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) c.status = "approved";
  return c;
}

export async function rejectComplex(id, reason = "") {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/reject`, { method: "POST", body: { reason } });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) {
    c.status = "rejected";
    c.rejection_reason = reason;
  }
  return c;
}

export async function publishComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/publish`, { method: "POST" });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) c.status = "published";
  return c;
}

export async function unpublishComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/unpublish`, { method: "POST" });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) c.status = "approved";
  return c;
}

export async function adminUpdateComplex(id, payload) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}`, { method: "PATCH", body: payload });
  return updateComplex(id, payload);
}

export async function adminDeleteComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}`, { method: "DELETE" });
  return deleteComplex(id);
}

export async function adminCreateComplex(ownerId, payload) {
  if (!USE_MOCK)
    return apiFetch("/admin/complexes", { method: "POST", body: { ...payload, owner_id: ownerId } });
  return createComplex(payload);
}

export async function listAdminHalls(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams(filters);
    const qs = params.toString();
    return apiFetch(`/admin/halls${qs ? `?${qs}` : ""}`);
  }
  return store.halls;
}

export async function approveHall(id) {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}/approve`, { method: "POST" });
  await delay();
  const h = store.halls.find((x) => x.id === id);
  if (h) h.status = "approved";
  return h;
}

export async function rejectHall(id, reason = "") {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}/reject`, { method: "POST", body: { reason } });
  await delay();
  const h = store.halls.find((x) => x.id === id);
  if (h) {
    h.status = "rejected";
    h.rejection_reason = reason;
  }
  return h;
}

export async function publishHall(id) {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}/publish`, { method: "POST" });
  await delay();
  const h = store.halls.find((x) => x.id === id);
  if (h) h.status = "published";
  return h;
}

export async function unpublishHall(id) {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}/unpublish`, { method: "POST" });
  await delay();
  const h = store.halls.find((x) => x.id === id);
  if (h) h.status = "approved";
  return h;
}

export async function adminUpdateHall(id, payload) {
  if (!USE_MOCK)
    return apiFetch(`/admin/halls/${id}`, { method: "PATCH", body: payload });
  return updateHall(id, payload);
}

export async function adminDeleteHall(id) {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}`, { method: "DELETE" });
  return deleteHall(id);
}

export async function listUsers(role) {
  if (!USE_MOCK) {
    const qs = role ? `?role=${role}` : "";
    return apiFetch(`/admin/users${qs}`);
  }
  await delay();
  return [
    { id: "user-admin", full_name: "مدیر ارشد", phone: "09000000000", role: "super_admin", status: "active" },
    { id: "user-owner", full_name: "مالک مجموعه", phone: "09120000000", role: "venue_owner", status: "active" },
    { id: "user-customer", full_name: "کاربر نمونه", phone: "09350000000", role: "customer", status: "active" },
  ].filter((u) => !role || u.role === role);
}

export async function createUser(payload) {
  if (!USE_MOCK) return apiFetch("/admin/users", { method: "POST", body: payload });
  await delay();
  return { id: uid("user"), status: "active", ...payload };
}

export async function updateUser(id, payload) {
  if (!USE_MOCK) return apiFetch(`/admin/users/${id}`, { method: "PATCH", body: payload });
  await delay();
  return { id, ...payload };
}

export async function suspendUser(id) {
  if (!USE_MOCK) return apiFetch(`/admin/users/${id}`, { method: "DELETE" });
  await delay();
}

/** Generates a new temporary password for a user; returns { password } once. */
export async function adminResetPassword(id) {
  if (!USE_MOCK) return apiFetch(`/admin/users/${id}/reset-password`, { method: "POST" });
  await delay();
  return { password: "Temp1234" };
}

export async function listOwnerBookings() {
  if (!USE_MOCK) return apiFetch("/owner/bookings");
  await delay();
  return store.bookings;
}

/** Owner requests cancellation of a confirmed booking; a super admin must approve it. */
export async function requestCancelBooking(id, reason = "") {
  if (!USE_MOCK) return apiFetch(`/owner/bookings/${id}/request-cancel`, { method: "POST", body: { reason } });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) {
    b.status = "cancellation_requested";
    b.cancellation_reason = reason;
  }
  return b;
}

export async function approveCancelBooking(id, reason = "") {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}/approve-cancel`, { method: "POST", body: { reason } });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) b.status = "cancelled_by_owner";
  return b;
}

export async function rejectCancelBooking(id, reason = "") {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}/reject-cancel`, { method: "POST", body: { reason } });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) b.status = "confirmed";
  return b;
}

export async function createHall(complexId, payload) {
  if (!USE_MOCK)
    return apiFetch(`/owner/complexes/${complexId}/halls`, {
      method: "POST",
      body: payload,
    });
  await delay();
  const hall = {
    id: uid("hall"),
    complex_id: complexId,
    status: "pending_approval",
    is_active: true,
    images: payload.images || [],
    amenities: payload.amenities || [],
    ...payload,
  };
  store.halls.unshift(hall);
  return hall;
}

export async function updateHall(id, payload) {
  if (!USE_MOCK)
    return apiFetch(`/owner/halls/${id}`, { method: "PATCH", body: payload });
  await delay();
  const idx = store.halls.findIndex((h) => h.id === id);
  if (idx >= 0) store.halls[idx] = { ...store.halls[idx], ...payload };
  return store.halls[idx];
}

export async function deleteHall(id) {
  if (!USE_MOCK) return apiFetch(`/owner/halls/${id}`, { method: "DELETE" });
  await delay();
  const idx = store.halls.findIndex((h) => h.id === id);
  if (idx >= 0) store.halls[idx].is_active = false;
}

// ---- Slots ----------------------------------------------------------------

export async function listAllBookings() {
  if (!USE_MOCK) {
    const res = await apiFetch("/admin/bookings?limit=2000");
    return Array.isArray(res) ? res : res?.items ?? [];
  }
  await delay();
  return store.bookings;
}

export async function adminCancelBooking(id, reason = "") {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}/cancel`, { method: "POST", body: { reason } });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) {
    b.status = "cancelled_by_owner";
    b.cancellation_reason = reason;
  }
  return b;
}

export async function adminConfirmBooking(id) {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}/confirm`, { method: "POST" });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) b.status = "confirmed";
  return b;
}

export async function createSlot(payload) {
  if (!USE_MOCK) return apiFetch("/owner/slots", { method: "POST", body: payload });
  await delay();
  const discount = Number(payload.discount_percent || 0);
  const base = Number(payload.base_price || 0);
  const slot = {
    id: uid("slot"),
    status: "available",
    duration_minutes: 90,
    final_price: Math.round((base * (100 - discount)) / 100),
    ...payload,
    discount_percent: discount,
    base_price: base,
  };
  store.slots.unshift(slot);
  return slot;
}

export async function setSlotStatus(id, status) {
  if (!USE_MOCK)
    return apiFetch(`/owner/slots/${id}`, { method: "PATCH", body: { status } });
  await delay(150);
  const slot = store.slots.find((s) => s.id === id);
  if (slot) slot.status = status;
  return slot;
}

// ---- Session management (owner calendar) ----------------------------------

/** Fetch owner sessions in [from, to) (ISO strings), optionally for one hall. */
export async function listSessions({ hallId, complexId, from, to } = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (hallId) params.set("hall_id", hallId);
    if (complexId) params.set("complex_id", complexId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/owner/sessions${qs ? `?${qs}` : ""}`);
  }
  await delay(200);
  return store.slots
    .filter((s) => (hallId ? s.hall_id === hallId : true))
    .map((s) => ({ ...s, fill: "available", remaining_spots: s.capacity || 1, revenue_estimate: 0 }));
}

export async function createSession(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions", { method: "POST", body: payload });
  return createSlot(payload);
}

/** Partial edit of one session (price, capacity, drag-resized time, status…). */
export async function updateSession(id, patch) {
  if (!USE_MOCK) return apiFetch(`/owner/sessions/${id}`, { method: "PATCH", body: patch });
  await delay(120);
  const slot = store.slots.find((s) => s.id === id);
  if (slot) Object.assign(slot, patch);
  return slot;
}

/** Permanently delete a session (rejected by the server if it has bookings). */
export async function deleteSession(id) {
  if (!USE_MOCK) return apiFetch(`/owner/sessions/${id}`, { method: "DELETE" });
  await delay(120);
  store.slots = store.slots.filter((s) => s.id !== id);
  return { ok: true };
}

export async function generateSessions(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions/generate", { method: "POST", body: payload });
  await delay();
  return { created: 0, skipped: 0, message: "mock" };
}

export async function copyDay(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions/copy-day", { method: "POST", body: payload });
  await delay();
  return { created: 0, message: "mock" };
}

export async function duplicateWeek(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions/duplicate-week", { method: "POST", body: payload });
  await delay();
  return { created: 0, message: "mock" };
}

export async function bulkUpdateSessions(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions/bulk-update", { method: "POST", body: payload });
  await delay();
  return { updated: 0, message: "mock" };
}

export async function blockRange(payload) {
  if (!USE_MOCK) return apiFetch("/owner/sessions/block-range", { method: "POST", body: payload });
  await delay();
  return { updated: 0, message: "mock" };
}

/** Admin/owner manual (walk-in) booking against a session. */
export async function manualBooking({ slotId, paymentType = "full_in_person" }) {
  if (!USE_MOCK)
    return apiFetch("/owner/bookings/manual", {
      method: "POST",
      body: { slot_id: slotId, payment_type: paymentType },
    });
  await delay();
  return { id: uid("booking"), slot_id: slotId };
}

export async function listSessionAudit(hallId) {
  if (!USE_MOCK) {
    const qs = hallId ? `?hall_id=${hallId}` : "";
    return apiFetch(`/owner/sessions/audit${qs}`);
  }
  await delay();
  return [];
}

/** Build complex/hall lookup maps for booking display screens. */
export async function loadVenueLookups({ admin = false, owner = false } = {}) {
  if (USE_MOCK) {
    return {
      complexMap: Object.fromEntries(store.complexes.map((c) => [c.id, c])),
      hallMap: Object.fromEntries(store.halls.map((h) => [h.id, h])),
    };
  }
  if (admin) {
    const [complexes, halls] = await Promise.all([listAdminComplexes(), listAdminHalls()]);
    return {
      complexMap: Object.fromEntries(complexes.map((c) => [c.id, c])),
      hallMap: Object.fromEntries(halls.map((h) => [h.id, h])),
    };
  }
  const complexes = owner ? await listOwnerComplexes() : await listComplexes();
  const halls = (
    await Promise.all(
      complexes.map((c) =>
        owner
          ? listHalls(c.id, { includeInactive: true })
          : listHalls(c.id)
      )
    )
  ).flat();
  return {
    complexMap: Object.fromEntries(complexes.map((c) => [c.id, c])),
    hallMap: Object.fromEntries(halls.map((h) => [h.id, h])),
  };
}

// ---- Admin aggregation (super admin dashboard) ----------------------------

export async function adminListVenues() {
  if (!USE_MOCK) return apiFetch("/admin/venues");
  await delay();
  return store.complexes.map((c) => ({
    ...c,
    owner_name: "مالک نمونه",
    halls: store.halls.filter((h) => h.complex_id === c.id),
    hall_count: store.halls.filter((h) => h.complex_id === c.id).length,
    slot_count: store.slots.filter((s) => s.complex_id === c.id).length,
    booking_count: store.bookings.filter((b) => b.complex_id === c.id).length,
  }));
}

export async function adminGetVenue(id) {
  if (!USE_MOCK) return apiFetch(`/admin/venues/${id}`);
  return (await adminListVenues()).find((v) => v.id === id) || null;
}

export async function adminListOwners() {
  if (!USE_MOCK) return apiFetch("/admin/owners");
  return listUsers("venue_owner");
}

export async function adminGetOwner(id) {
  if (!USE_MOCK) return apiFetch(`/admin/owners/${id}`);
  await delay();
  return { id, venues: [], stats: {}, bookings: [] };
}

export async function adminListCustomers() {
  if (!USE_MOCK) return apiFetch("/admin/customers");
  return listUsers("customer");
}

export async function adminGetCustomer(id) {
  if (!USE_MOCK) return apiFetch(`/admin/customers/${id}`);
  await delay();
  return { id, bookings: [], cancellations: [], stats: {}, favorite_venues: [], favorite_sports: [] };
}

/** Paginated, filterable bookings for admin. Returns { items, total, page, limit }. */
export async function adminListBookings(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(`/admin/bookings${qs ? `?${qs}` : ""}`);
  }
  await delay();
  return { items: store.bookings, total: store.bookings.length, page: 1, limit: 20 };
}

export async function adminGetBooking(id) {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}`);
  await delay();
  return store.bookings.find((b) => b.id === id) || null;
}

// ---- Finance / analytics ---------------------------------------------------

export async function getOwnerFinanceSummary() {
  if (!USE_MOCK) return apiFetch("/owner/finance/summary");
  await delay();
  return { total_revenue: 0, online_payments: 0, deposits: 0, refunds: 0, platform_commission: 0, net_settlement: 0 };
}

export async function getOwnerAnalytics() {
  if (!USE_MOCK) return apiFetch("/owner/finance/analytics");
  await delay();
  return {
    total_reservations: 0,
    total_revenue: 0,
    cancelled_reservations: 0,
    holiday_closure_days: 0,
    total_refund_amount: 0,
    refunded_count: 0,
    revenue_trend: [],
    reservation_trend: [],
  };
}

export async function getAdminFinanceSummary() {
  if (!USE_MOCK) return apiFetch("/admin/finance/summary");
  await delay();
  return { platform_revenue: 0, failed_payments: 0, pending_settlements: 0 };
}

export async function getAdminAnalytics({ from, to } = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return apiFetch(`/admin/finance/analytics${qs ? `?${qs}` : ""}`);
  }
  await delay();
  return {
    total_revenue: 0,
    total_reservations: 0,
    total_customers: 0,
    total_venues: 0,
    revenue_trend: [],
    reservation_trend: [],
    revenue_by_period: { current: 0, previous: 0, change_pct: 0 },
    reservations_by_sport: [],
    reservations_by_city: [],
    reservations_by_status: [],
    top_venues: [],
    customer_distribution_by_city: [],
  };
}

// ---- Support (Contact Us / Report a Bug / Tickets) -------------------------

export async function submitTicket({ category = "contact", name, phone, subject, message }) {
  if (!USE_MOCK)
    return apiFetch("/support/tickets", {
      method: "POST",
      body: { category, name, phone, subject, message },
    });
  await delay();
  return { id: uid("ticket"), category, status: "open" };
}

/** The current user's own ticket submissions, with any admin reply. */
export async function myTickets() {
  if (!USE_MOCK) return apiFetch("/my/tickets");
  await delay();
  return [];
}

/** Paginated, filterable tickets for the platform admin inbox. */
export async function adminListTickets(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(`/admin/support/tickets${qs ? `?${qs}` : ""}`);
  }
  await delay();
  return { items: [], total: 0, page: 1, limit: 20 };
}

export async function adminGetTicket(id) {
  if (!USE_MOCK) return apiFetch(`/admin/support/tickets/${id}`);
  await delay();
  return null;
}

export async function adminReplyTicket(id, reply) {
  if (!USE_MOCK)
    return apiFetch(`/admin/support/tickets/${id}/reply`, { method: "POST", body: { reply } });
  await delay();
  return { id, admin_reply: reply };
}

export async function adminUpdateTicketStatus(id, status) {
  if (!USE_MOCK)
    return apiFetch(`/admin/support/tickets/${id}/status`, { method: "PATCH", body: { status } });
  await delay();
  return { id, status };
}

/** @deprecated Use loadVenueLookups() instead when USE_MOCK=false */
export function getStore() {
  return store;
}
