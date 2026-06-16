# Backend API

Base path: `/api/v1`

## Auth

Sensitive auth endpoints are rate limited per IP.

- `POST /auth/register`
- `POST /auth/owner/register` — Vendor Admin (venue owner) self-service signup. Validates Iranian national code + mobile + password strength; rejects duplicate phone or national code. Returns an access token.
- `POST /auth/login` — phone + password (+ optional `remember_me` for a longer-lived token). Locks the account after repeated failures.
- `POST /auth/password/forgot` — sends an OTP reset code to an existing account's phone (reuses the SMS/OTP architecture; demo phone bypass).
- `POST /auth/password/reset` — `{ phone, code, new_password }` verifies the code and sets a new password.
- `POST /auth/otp/request` / `POST /auth/otp/verify` — customer one-time-code login.
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`

## Public discovery

- `GET /sports`
- `GET /provinces` — all 31 Iranian provinces (province dropdown source; city is free text).
- `GET /complexes`
- `GET /complexes/:id`
- `GET /complexes/:complexId/halls`
- `GET /slots`
- `GET /halls/:hallId/slots`
- `GET /map/venues?lat=&lng=&radius=&sport_id=&discount_only=&available_only=`
- `GET /complexes/:complexId/reviews`

## Customer

- `POST /bookings` with `Idempotency-Key`
- `GET /my/bookings`
- `POST /bookings/:id/cancel`
- `POST /payments/initiate`
- `POST /payments/verify`
- `GET /my/payments`
- `GET /wallet`
- `GET /wallet/transactions`
- `POST /wallet/topup`
- `POST /bookings/:bookingId/reviews`

## Owner

- `POST /owner/complexes`
- `PATCH /owner/complexes/:id`
- `POST /owner/complexes/:complexId/halls`
- `POST /owner/slots`
- `POST /owner/slots/bulk`

### Session management (calendar)

- `GET /owner/sessions?hall_id=&complex_id=&from=&to=` — sessions in a range, enriched with `fill`, `remaining_spots`, `revenue_estimate`, `almost_full`, `low_demand`.
- `POST /owner/sessions` — create a one-time session (capacity, title, notes).
- `PATCH /owner/sessions/:id` — partial edit: drag-resized `starts_at`/`ends_at`, price, discount, capacity, status, title, notes, internal comment.
- `POST /owner/sessions/generate` — recurring/bulk creation over a date range + weekdays, with peak pricing and exception (holiday) dates.
- `POST /owner/sessions/copy-day` — clone a day's sessions to other days.
- `POST /owner/sessions/duplicate-week` — repeat a week's sessions forward N weeks.
- `POST /owner/sessions/bulk-update` — set price/discount/capacity/status across selected sessions.
- `POST /owner/sessions/block-range` — close / maintenance / holiday / special-event over a hall + time window (temporary closures, emergency shutdowns).
- `POST /owner/sessions/:id/manual-booking` — owner-side (walk-in) booking.
- `GET /owner/sessions/audit?hall_id=` — schedule change history.

### Bookings & finance

- `GET /owner/bookings`
- `POST /owner/bookings/manual`
- `GET /owner/payments`
- `POST /owner/reviews/:id/reply`
- `GET /owner/finance/summary`
- `GET /owner/finance/transactions`

## Super admin

### Dashboard aggregation (read-only)

- `GET /admin/venues` — all venues with their **halls nested**, owner name/phone, and slot/booking counts (merged venues + facilities view).
- `GET /admin/venues/:id` — one venue with halls, owner identity (name, phone, national code, address), and counts; powers the request-approval detail view.
- `GET /admin/owners` / `GET /admin/owners/:id` — owner profiles with registered venues, booking stats, and derived last-activity.
- `GET /admin/customers` / `GET /admin/customers/:id` — customer profiles with full booking history, cancellations, derived favorite venues/sports, and stats.
- `GET /admin/bookings?status=&payment_status=&complex_id=&customer_id=&q=&from=&to=&page=&limit=` — **paginated, filterable, searchable** bookings (each item enriched with customer + venue/hall names). Returns `{items, total, page, limit}`.
- `GET /admin/bookings/:id` — full booking detail: customer, venue, hall, payments, and the status **timeline/audit trail**.

### Moderation & management

- `POST /admin/sports`, `PATCH /admin/sports/:id`, `DELETE /admin/sports/:id`
- `POST /admin/complexes/:id/approve`
- `POST /admin/complexes/:id/reject` — accepts optional `{ "reason": "…" }`, stored as the complex `rejection_reason`.
- `POST /admin/halls/:id/approve`, `POST /admin/halls/:id/reject` (reject takes optional `{reason}`)
- `POST /admin/bookings/:id/confirm`
- `POST /admin/bookings/:id/cancel` — accepts optional `{ "reason": "…" }`; records a refund and a timeline event.
- `POST /admin/reviews/:id/moderate`
- `GET /admin/finance/summary`, `GET /admin/finance/settlements`
