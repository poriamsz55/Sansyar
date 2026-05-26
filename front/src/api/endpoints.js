// API surface mirroring docs/backend-api.md. With USE_MOCK=true (default for the
// MVP) it serves the local dataset; set VITE_USE_MOCK=false to hit the Go API.

import { apiFetch, setToken } from "./client";
import * as mock from "../data/mock";
import { SPORTS } from "../lib/constants";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";

// Mutable in-memory store so admin "create" actions and bookings persist
// for the lifetime of the session.
const store = {
  complexes: structuredClone(mock.complexes),
  halls: structuredClone(mock.halls),
  slots: structuredClone(mock.slots),
  bookings: structuredClone(mock.bookings),
};

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function enrichComplex(c) {
  return {
    ...c,
    sports: (c.sport_ids || []).map(
      (id) => SPORTS.find((s) => s.id === id)?.name || id
    ),
  };
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
  // Mock identities matching backend seed users.
  const users = {
    "09000000000": { id: "user-admin", full_name: "مدیر کل", role: "super_admin" },
    "09120000000": { id: "user-owner", full_name: "مدیر مجموعه", role: "venue_owner" },
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

// ---- Public discovery -----------------------------------------------------

export async function listSports() {
  if (!USE_MOCK) return apiFetch("/sports");
  await delay(150);
  return SPORTS;
}

export async function listComplexes(filters = {}) {
  if (!USE_MOCK) {
    const qs = new URLSearchParams(filters).toString();
    return apiFetch(`/complexes${qs ? `?${qs}` : ""}`);
  }
  await delay();
  let items = store.complexes.map(enrichComplex);
  const { sportId, city, maxPrice, q } = filters;
  if (sportId) items = items.filter((c) => c.sport_ids?.includes(sportId));
  if (city) items = items.filter((c) => c.city === city);
  if (maxPrice) items = items.filter((c) => c.lowest_price <= maxPrice);
  if (q)
    items = items.filter(
      (c) => c.name.includes(q) || c.city.includes(q) || c.neighborhood?.includes(q)
    );
  return items;
}

export async function getComplex(id) {
  if (!USE_MOCK) return apiFetch(`/complexes/${id}`);
  await delay();
  const c = store.complexes.find((x) => x.id === id);
  return c ? enrichComplex(c) : null;
}

export async function listHalls(complexId) {
  if (!USE_MOCK) return apiFetch(`/complexes/${complexId}/halls`);
  await delay();
  return store.halls.filter((h) => h.complex_id === complexId);
}

export async function listSlots({ hallId, complexId } = {}) {
  if (!USE_MOCK) {
    if (hallId) return apiFetch(`/halls/${hallId}/slots`);
    const qs = complexId ? `?complex_id=${complexId}` : "";
    return apiFetch(`/slots${qs}`);
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

// ---- Owner / Admin --------------------------------------------------------

export async function listAllBookings() {
  if (!USE_MOCK) return apiFetch("/admin/bookings");
  await delay();
  return store.bookings;
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
    images: [],
    amenities: [],
    rules: [],
    available_slot_count: 0,
    discount_percent: 0,
    lowest_price: payload.lowest_price || 0,
    ...payload,
  };
  store.complexes.unshift(complex);
  return complex;
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
    is_active: true,
    images: [],
    amenities: [],
    ...payload,
  };
  store.halls.unshift(hall);
  return hall;
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
  // No exact REST endpoint in the MVP; the owner toggles availability locally.
  await delay(150);
  const slot = store.slots.find((s) => s.id === id);
  if (slot) slot.status = status;
  return slot;
}

export function getStore() {
  return store;
}
