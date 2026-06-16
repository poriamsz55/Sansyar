# Data models

MongoDB collections:

- `users` — also stores Vendor Admin fields (`first_name`, `last_name`, `national_id`, `address`) and brute-force fields (`failed_logins`, `locked_until`)
- `venue_owners` reserved for expanded owner profile documents
- `provinces` — all 31 Iranian provinces; seeded on every boot (city is free text on the complex)
- `sports`
- `complexes` — now include `province` and `rejection_reason`; `city` is free text
- `halls` — now include `rejection_reason`
- `hall_schedules` reserved for recurring templates
- `time_slots` — sessions now carry `capacity`, `booked_count`, `title`, `notes`, `admin_comment`; statuses include `closed`/`holiday`/`maintenance`/`special_event`. Booking fill (available/partial/full) is derived from `booked_count` vs `capacity`
- `bookings` — now carry `notes`, `cancellation_reason`, `cancelled_at`, `refund_amount`, `coupon_code`, and an embedded `timeline` (audit trail of created/confirmed/cancelled events)
- `payments`
- `wallet_accounts`
- `wallet_transactions`
- `discounts` reserved for reusable campaigns
- `reviews`
- `comments` reserved for threaded discussions
- `notifications` reserved for in-app notification feed
- `sms_logs` reserved for provider delivery tracking
- `finance_events` reserved for ledger-style finance reporting
- `audit_logs` — schedule-change history for the session manager (actor, hall, action, details)

Important indexes are created on boot: unique `users.phone` and sparse-unique `users.national_id`, complex `location` as `2dsphere`, slot hall/time uniqueness, slot search fields, idempotency key uniqueness, wallet account uniqueness, and review uniqueness per booking. For multi-capacity sessions, the legacy single-booking-per-slot index is dropped and replaced by a partial unique index on `(slot_id, customer_id)` over active statuses — many customers can fill a session's capacity, but one customer cannot double-book it.
