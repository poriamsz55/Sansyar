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
