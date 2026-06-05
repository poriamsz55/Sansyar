// API surface for Sansyar. Set VITE_USE_MOCK=false to use the Go backend.

import { apiFetch, setToken } from "./client";
import * as mock from "../data/mock";
import { SPORTS } from "../lib/constants";

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

export async function login({ phone, password }) {
  if (!USE_MOCK) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: { phone, password },
    });
    setToken(data.access_token);
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

// ---- Public discovery -----------------------------------------------------

export async function listSports() {
  if (!USE_MOCK) return apiFetch("/sports");
  await delay(150);
  return SPORTS;
}

export async function listComplexes(filters = {}) {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    if (filters.city) params.set("city", filters.city);
    if (filters.q) params.set("q", filters.q);
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    const data = await apiFetch(`/complexes${qs ? `?${qs}` : ""}`);
    const items = normalizeComplexList(data);
    const sportsMap = await getSportsMap();
    return items.map((c) =>
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
  await delay();
  let items = store.complexes.map((c) => enrichComplex(c));
  const { sportId, city, maxPrice, q } = filters;
  if (sportId) items = items.filter((c) => c.sport_ids?.includes(sportId));
  if (city) items = items.filter((c) => c.city === city);
  if (maxPrice) items = items.filter((c) => c.lowest_price <= maxPrice);
  if (q)
    items = items.filter(
      (c) =>
        c.name.includes(q) || c.city.includes(q) || c.neighborhood?.includes(q)
    );
  return items;
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
  if (idx >= 0) store.complexes[idx].status = "suspended";
}

export async function approveComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/approve`, { method: "POST" });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) c.status = "approved";
  return c;
}

export async function rejectComplex(id) {
  if (!USE_MOCK)
    return apiFetch(`/admin/complexes/${id}/reject`, { method: "POST" });
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  if (c) c.status = "rejected";
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

export async function rejectHall(id) {
  if (!USE_MOCK) return apiFetch(`/admin/halls/${id}/reject`, { method: "POST" });
  await delay();
  const h = store.halls.find((x) => x.id === id);
  if (h) h.status = "rejected";
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

export async function listOwnerBookings() {
  if (!USE_MOCK) return apiFetch("/owner/bookings");
  await delay();
  return store.bookings;
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
  if (!USE_MOCK) return apiFetch("/admin/bookings");
  await delay();
  return store.bookings;
}

export async function adminCancelBooking(id) {
  if (!USE_MOCK) return apiFetch(`/admin/bookings/${id}/cancel`, { method: "POST" });
  await delay();
  const b = store.bookings.find((x) => x.id === id);
  if (b) b.status = "cancelled_by_owner";
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

/** @deprecated Use loadVenueLookups() instead when USE_MOCK=false */
export function getStore() {
  return store;
}
