// Carries the pending slot selection from the details page to the reservation
// summary. sessionStorage keeps it alive across a refresh of the flow.

const KEY = "sansyar.pending_reservation";

export function savePendingReservation(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function getPendingReservation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearPendingReservation() {
  sessionStorage.removeItem(KEY);
}

/** Matches the backend booking rule: a session is gone once its start has passed. */
export function isSlotInTheFuture(slot) {
  if (!slot?.starts_at) return false;
  return new Date(slot.starts_at).getTime() > Date.now();
}
