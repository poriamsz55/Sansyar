# Booking flow

1. Customer selects complex, hall, sport, and available slot.
2. Client sends `POST /api/v1/bookings` with an `Idempotency-Key`.
3. Backend reads the slot and rejects expired slots.
4. Backend atomically updates the slot from `available` to `reserved`.
5. Backend creates a booking with payment, amount, cancellation, and slot snapshots.
6. A unique partial index prevents more than one active booking for the same slot.
7. If booking insert fails, the service releases the slot back to `available`.
8. Cancellation updates booking status and releases the slot when allowed.

This MVP does not rely on client-side locking. The server is the authority for slot state.
