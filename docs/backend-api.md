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

## Store (sports shop)

Public catalog (no auth). Product list responses are always paginated
(`{items, total, page, limit}`); each item carries a live variant summary
(`price_from`, `original_from`, `discount_max`, `total_stock`,
`available_stock`, `primary_image`) computed from active variants.

- `GET /store/products?q=&category_id=&brand_id=&page=&limit=` — published, active products only
- `GET /store/products/:idOrSlug` — detail with active variants and resolved category/brand (404 when draft/unpublished)
- `GET /store/categories` / `GET /store/brands` — active only

### Store admin (super admin)

- `GET /admin/store/products?q=&status=&category_id=&brand_id=&page=&limit=` — all products incl. drafts
- `POST /admin/store/products` — creates the product plus its implicit `default` variant (`price`, `original_price`, `stock`, optional `sku`; auto-SKU when empty; slug auto-generated from the name when omitted, uniqueness ensured)
- `GET /admin/store/products/:id` — admin detail incl. inactive variants
- `PATCH /admin/store/products/:id` — partial update; `price`/`original_price`/`stock` patch the default variant
- `POST /admin/store/products/:id/publish` / `POST /admin/store/products/:id/unpublish`
- `DELETE /admin/store/products/:id` — removes the product and its variants (orders keep snapshots)
- `GET|POST /admin/store/categories`, `PATCH|DELETE /admin/store/categories/:id` — delete is blocked while products reference the category
- `GET|POST /admin/store/brands`, `PATCH|DELETE /admin/store/brands/:id` — same reference guard

Product images are uploaded first via `POST /admin/uploads` (folder
`store/products`) and attached as `images: [{url, alt, is_primary}]`; the
backend normalises exactly one primary image (first by default).

#### Store — Cart, Checkout & Orders (Phases 3–4)

**Cart** (guests identified by `X-Cart-Token` header — returned on first add; merges into the user cart on the first authenticated request; prices/stock resolved live server-side, never stored):
- `GET /store/cart` → `{cart: {items[], item_count, subtotal, total, has_issues}}` (+`cart_token` for new guest carts)
- `POST /store/cart/items` `{variant_id, qty}` → cart view (409 if qty > available)
- `PATCH /store/cart/items/:variantId` `{qty}` · `DELETE /store/cart/items/:variantId` · `DELETE /store/cart`

**Settings/addresses** (auth: customer/super_admin):
- `GET /store/settings` (public) → shipping methods `{id,name,fee,eta_days,is_active}`
- `GET|POST /store/addresses`, `PATCH|DELETE /store/addresses/:id`

**Checkout** — `POST /store/checkout` `{address_id | new_address{...}, save_address, shipping_method_id, customer_note}` + `Idempotency-Key` header → order (status `pending_payment`, payment `unpaid`, full item/address snapshots, server-computed totals = subtotal + shipping; cart cleared; duplicate key returns the original order).

**Orders**:
- `GET /store/orders`, `GET /store/orders/:id` (own orders only), `POST /store/orders/:id/cancel` (only while `pending_payment`)
- Admin: `GET /admin/store/orders?status=&payment_status=&q=&page=&limit=`, `GET /admin/store/orders/:id`, `PATCH /admin/store/orders/:id/status` `{status, note, tracking_code}`
- Status machine: `pending_payment→cancelled · paid→(processing|cancelled) · processing→(shipped|cancelled) · shipped→delivered`; `paid` is set ONLY by payment verification; every change appends a timeline event. Transitions are enforced server-side.

#### Store — Payment, Inventory, Coupons & Admin (Phases 5–8)

**Payment** (dev gateway, server-verified amounts):
- `POST /store/orders/:id/pay` → `{payment, redirect_url:"/store/pay/:id"}` — amount copied from the order server-side; reuses a live `created` attempt
- `POST /store/payments/:id/complete` `{result:"success"|"failure"}` → atomic claim; success flips order `pending_payment→paid` (only this path may), failure marks attempt failed for retry; admin cancel of paid orders refunds payments (`payment_status:"refunded"`)

**Inventory** (all atomic conditional updates):
- reserve on checkout (`reserved+=qty`, guard `stock-reserved>=qty`, rollback on failure), commit on payment (`stock-=qty, reserved-=qty`), release on cancel-unpaid, restock on cancel-paid
- `GET /admin/store/inventory` (all variants, scarcest first), `POST /admin/store/variants/:id/stock` `{delta,reason}` (negative-stock guarded), `GET /admin/store/inventory/logs?variant_id|product_id|order_id`

**Coupons** (`store_coupons`, `store_coupon_usage`):
- `POST /store/cart/coupon` `{code}` / `DELETE /store/cart/coupon` — re-validated on every cart read; percent (with optional max cap) or fixed amount; min-subtotal, global usage limit, per-user limit; redemption claimed atomically at checkout and snapshotted on the order (`coupon_code`, `coupon_discount`)
- Admin: `GET|POST /admin/store/coupons`, `PATCH|DELETE /admin/store/coupons/:id`

**Admin completion**:
- `GET /admin/store/stats` (orders by status, revenue total/today, products, low-stock)
- `GET|PUT /admin/store/settings` (store info, open/closed, shipping methods CRUD — changes affect new orders only)
- `GET /admin/store/customers` (aggregated from orders: counts, spend, recency)
