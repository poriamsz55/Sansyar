# Backend API

Base path: `/api/v1`

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`

## Public discovery

- `GET /sports`
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
- `GET /owner/bookings`
- `POST /owner/bookings/manual`
- `GET /owner/payments`
- `POST /owner/reviews/:id/reply`
- `GET /owner/finance/summary`
- `GET /owner/finance/transactions`

## Super admin

- `POST /admin/sports`
- `PATCH /admin/sports/:id`
- `DELETE /admin/sports/:id`
- `POST /admin/complexes/:id/approve`
- `POST /admin/complexes/:id/reject`
- `GET /admin/bookings`
- `POST /admin/reviews/:id/moderate`
- `GET /admin/finance/summary`
- `GET /admin/finance/settlements`
