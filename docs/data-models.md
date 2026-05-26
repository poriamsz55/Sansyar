# Data models

MongoDB collections:

- `users`
- `venue_owners` reserved for expanded owner profile documents
- `sports`
- `complexes`
- `halls`
- `hall_schedules` reserved for recurring templates
- `time_slots`
- `bookings`
- `payments`
- `wallet_accounts`
- `wallet_transactions`
- `discounts` reserved for reusable campaigns
- `reviews`
- `comments` reserved for threaded discussions
- `notifications` reserved for in-app notification feed
- `sms_logs` reserved for provider delivery tracking
- `finance_events` reserved for ledger-style finance reporting
- `audit_logs` reserved for sensitive admin actions

Important indexes are created on boot: complex `location` as `2dsphere`, slot hall/time uniqueness, slot search fields, active booking uniqueness by slot, idempotency key uniqueness, wallet account uniqueness, and review uniqueness per booking.
