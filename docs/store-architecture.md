# Store Module — Architecture & Implementation Plan (Phase 0)

Discovery-based plan for adding a sports-goods **Store** to Sansyar. Everything
below is grounded in the actual codebase (no new infrastructure is introduced
where Sansyar already provides it).

## 1. What exists (findings)

| Concern | Existing infrastructure | Reuse decision |
| --- | --- | --- |
| Frontend | `front/` — Vite + React 18 + Tailwind + React Router v6, Persian RTL, framer-motion, lucide icons. Layouts: `SiteLayout` (customer), `OwnerLayout`, `PlatformLayout` (super admin). Shared UI kit in `src/components/ui/*`, `Toast`, `ConfirmDialog`, `ImageUpload`, `PageTransition/EmptyState`, `BottomNav` | Reuse everything; Store pages live under `SiteLayout`, Store Admin under `PlatformLayout` |
| Frontend data layer | `src/api/client.js` (`apiFetch`, `apiUpload`, bearer token) + `src/api/endpoints.js` (one function per endpoint, `USE_MOCK` toggle) | Add `store*` endpoint functions in the same files |
| Backend | Go 1.25 + Echo, module `sansyar/backend`, `cmd/api/bootstrap` composition root (app.go, routes.go, indexes.go, seed.go, server.go) | New `internal/store` domain wired in bootstrap, same pattern |
| Database | MongoDB via generic `database.Repository[T]` (`pkg/database`); indexes created on boot in `indexes.go`; no migrations | Store collections + boot indexes, same pattern |
| Auth | JWT bearer (`pkg/middleware.Auth` + `RequireRoles`), roles: `super_admin`, `venue_owner`, `venue_manager`, `staff`, `customer`. Customer OTP login, admin/owner password login. `requestctx.UserID/Role` | Reuse as-is. Store admin = `super_admin` (platform panel) |
| Admin infra | `/platform/*` super-admin panel (dashboard, venues, owners, customers, bookings, finance, sports, tickets) with `/admin/*` backend group guarded by `RequireRoles(RoleSuperAdmin)` | Store Admin = new section inside `/platform` + `/api/v1/admin/store/*` |
| File/image storage | MinIO via `pkg/storage` (S3 SigV4, public-read bucket, content-type allowlist) + `POST /owner/uploads` & `POST /admin/uploads` (multipart, ≤10MB) returning `{url}`; `ImageUpload`/`BannerUpload` components | Reuse upload endpoint + components (folder `store`) |
| Payment | `internal/payment`: fake/dev provider; `Initiate` creates Payment with `redirect_url /dev/fake-payment/<id>`, `Verify` stub, `Webhook` no-op; payments tied to `booking_id` | No real provider exists → keep provider abstraction; Store gets its own payment records keyed by `order_id`, same fake/dev flow until a real gateway is contracted |
| User/profile | `auth.User` (full_name, phone, single flat `address` string); `PATCH /me` | Store adds a proper multi-address model (`store_addresses`) — the flat string is not enough for shipping |
| API conventions | REST under `/api/v1`; snake_case JSON; `errormap` error tags (`input/auth/permission/not_found/conflict/internal`); pagination `{items,total,page,limit}` when `page`/`limit` requested; filters as query params (`q`, `page`, `limit`, …); Idempotency-Key header pattern on create | Follow all of them |
| Concurrency pattern | Atomic conditional `UpdateOne` (claim slot only when `booked_count<1`), check `MatchedCount==0` → `ErrConflict`; idempotency-key collection with unique index | Reuse exactly this for stock reservation |
| Money | Rial minor units (`int64`), displayed as Toman via `formatToman` | Same |
| Testing/build | Backend: `go build ./...`, `go test ./...` (unit tests in-package, e.g. `booking/service_test.go`). Frontend: `npm run build` in `front/` (no lint/test configured). Deploy: `deploy/docker-compose.yml` (mongo, minio) | These are the phase gates |
| Runtime | MinIO container running; Vite dev server on 5173; Mongo container **not running** (start with `docker compose -f deploy/docker-compose.yml up -d mongo`) | Start when needed for verification |

Stale docs note: `README`/`Makefile` mention `apps/web` / `apps/admin` npm
workspaces, but the real frontend is `front/` (its own package). The workspace
scripts are dead; use `cd front && npm run dev`.

## 2. Store module boundaries (backend)

One domain package `internal/store`, same three-file convention as `sport` /
`venue` (`store.go` entities + requests, `service.go`, `handler.go`), wired in
`bootstrap`. It owns these MongoDB collections:

- `store_categories` — name, slug, icon, is_active, sort
- `store_brands` — name, slug, logo, is_active
- `store_products` — name, slug, description, category_id, brand_id,
  embedded `images []ProductImage{url, alt, is_primary}`,
  embedded `attributes []{key, value}`, status (`draft`/`published`),
  is_active, timestamps. Display price range derived from variants at read time
- `store_product_variants` — **own collection** (not embedded) so stock
  reservation is one atomic conditional `UpdateOne` per variant (the slot-claim
  pattern): product_id, name, options `[]{key,value}`, unique SKU, price,
  original_price, stock, reserved, is_active
- `store_carts` / embedded items — owner is `user_id` **or** anonymous
  `cart_token`; guest carts merge into the user cart on first authenticated
  request that carries the token
- `store_orders` — status machine, items with full snapshots (product name,
  variant name/options, SKU, unit price, discount, quantity), totals,
  shipping address snapshot, coupon snapshot, embedded `timeline []OrderEvent`,
  idempotency key
- `store_order_payments` — order-scoped payment records (fake/dev provider)
- `store_addresses` — per-user saved shipping addresses
- `store_coupons` — percent/fixed, window, min order, usage limits, optional
  product/category scoping
- `store_inventory_logs` — append-only stock movements (reason, actor, order)
- `store_settings` — single doc: store name, logo, banner, support phone,
  open/closed, shipping methods `[{id, name, fee, eta}]`

Order status machine (invalid transitions rejected, events appended to
timeline): `pending_payment → paid → processing → shipped → delivered`,
`pending_payment → cancelled` (auto after payment expiry), `paid → cancelled`
(refund case), payment failure keeps `pending_payment` until expiry/cancel.

Inventory semantics: reserve on order creation (`reserved += qty`, only if
`stock - reserved >= qty`), commit on verified payment (`stock -= qty,
reserved -= qty`), release on cancel/expiry/failed payment (`reserved -= qty`).

## 3. API structure

Public catalog (no auth):

- `GET /api/v1/store/products?q=&category=&brand=&min_price=&max_price=&availability=&sort=&page=&limit=`
- `GET /api/v1/store/products/:idOrSlug`
- `GET /api/v1/store/categories` · `GET /api/v1/store/brands`
- `POST /api/v1/store/payments/webhook` (provider callback, idempotent)

Customer (auth, roles customer + super_admin):

- `GET/POST/PATCH/DELETE /api/v1/store/cart…` (+ `X-Cart-Token` for guests,
  merge-on-login)
- `POST /api/v1/store/checkout` (Idempotency-Key) — re-prices server-side
- `GET /api/v1/store/orders` · `GET /api/v1/store/orders/:id` ·
  `POST /api/v1/store/orders/:id/cancel`
- `POST /api/v1/store/payments/initiate|verify`
- `GET/POST/PATCH/DELETE /api/v1/store/addresses`

Store Admin (auth, role super_admin):

- `GET/POST/PATCH/DELETE /api/v1/admin/store/products(+/:id, /:id/publish,
  /:id/unpublish, /:id/variants…, /:id/images)`
- Same CRUD shape for `categories`, `brands`, `coupons`
- `GET /api/v1/admin/store/orders(+/:id, /:id/status)` ·
  `GET /api/v1/admin/store/inventory(+/logs, /variants/:id/stock)` ·
  `GET/PUT /api/v1/admin/store/settings` · `GET /api/v1/admin/store/dashboard`
  · `GET /api/v1/admin/store/customers`

## 4. Frontend route structure

Customer (inside `SiteLayout`, Persian RTL like the rest of the site):

- `/store` — homepage + listing (search, category/brand/price/availability
  filters, sort, load-more pagination)
- `/store/products/:slug` — gallery, variant picker, price/discount/stock,
  specs, add-to-cart
- `/store/cart` · `/store/checkout` · `/store/orders` · `/store/orders/:id`
- Saved addresses managed inside checkout/profile

Store Admin (inside `PlatformLayout`, super admin):

- `/platform/store` — dashboard (revenue, orders, best sellers, low stock…)
- `/platform/store/products` + `/platform/store/products/:id`
  (edit: images, variants, pricing, stock, publish)
- `/platform/store/categories` · `/platform/store/brands` ·
  `/platform/store/orders(+/:id)` · `/platform/store/inventory` ·
  `/platform/store/coupons` · `/platform/store/customers` ·
  `/platform/store/settings`

## 5. Authentication/authorization strategy

- No new auth. Public catalog is anonymous; cart supports guests via
  `X-Cart-Token`; checkout/orders/payments require `customer` or `super_admin`
  (mirrors the booking routes); all admin/store routes require `super_admin`
  (mirrors the admin group). Storefront links the customer into `/login`
  (existing OTP flow) when needed.
- Prices, totals, discounts and payment success are **only** decided by the
  backend; the frontend never sends computed money.

## 6. Integration points with Sansyar

- Auth users & roles (no separate store accounts)
- MinIO upload endpoint + `ImageUpload` components (folder `store/...`)
- Fake/dev payment provider convention (`redirect_url` + verify + webhook),
  replaced later by a real gateway behind the same endpoints
- Wallet, reviews, notifications: **out of scope** for the store MVP
- Discovery/booking flows untouched

## 7. Phase implementation plan (mapped to the requested phases)

| Phase | Scope | Gate (must pass before next phase) |
| --- | --- | --- |
| 1 Foundation | `internal/store` domain: Category, Brand, Product (+ implicit default variant), ProductImage; basic CRUD APIs; `/store` route+layout+nav+homepage+listing+detail; platform Store Admin: products/categories/brands lists + create/edit | Vertical: admin creates product → DB → store listing → detail page. `go build`, `go test`, `npm run build`, live curl checks |
| 2 Catalog | Variants (SKU/price/original/discount/stock/attributes), images gallery + primary, search/category/brand/price/availability filters, sort, pagination; admin variant/price/stock/image management + publish toggle | Admin fully configures variant product; user finds it via search/filters and sees live data |
| 3 Cart | Cart entities + APIs (server-priced), cart page, guest cart + merge | Add → modify → correct totals end-to-end |
| 4 Checkout & orders | Addresses, shipping method, order creation with snapshots, My Orders, admin orders (list/detail/search/filter/status/timeline) | Cart → checkout → order visible to user & admin (no payment yet) |
| 5 Payment | Order payments (fake/dev provider), initiate/redirect/verify/webhook, idempotent callbacks, failed handling | Real end-to-end purchase with verified payment |
| 6 Inventory | Reserved/available stock, atomic reservation, commit/release rules, inventory logs, admin inventory views + stock editing | Stock correct through success/failure/cancel/concurrency |
| 7 Coupons | Coupon CRUD, backend validation/apply/remove, totals | Valid coupon changes total; invalid/expired/exhausted rejected |
| 8 Admin completion | Dashboard metrics, customer list, store settings, order/customer management polish | All admin screens real (no mock data) |
| 9 Polish | Mobile/RTL refinements, skeletons, empty/error states, toasts, confirmations, image handling, a11y | Store review as a customer; no placeholders/dead routes |
| 10 Final verification | Full customer & admin flows, edge cases (out-of-stock, coupon misuse, duplicate callbacks, price drift, concurrency, invalid transitions, unauthorized access), full builds/tests, regression of existing Sansyar flows | All critical edge cases handled; existing functionality intact |

Explicitly out of MVP (architecture stays open to them): wishlist, reviews,
recommendations, flash sales, multi-vendor, loyalty, analytics beyond the
admin dashboard.
