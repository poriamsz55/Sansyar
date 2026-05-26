# Payment flow

The MVP has a payment abstraction surface and fake provider behavior:

- `full_online`, `wallet`, and `mixed` create confirmed bookings with paid status in local development.
- `deposit_online_remaining_in_person` stores deposit and remaining amount.
- `full_in_person` stores `pay_at_venue`.
- `/payments/initiate`, `/payments/verify`, and `/payments/webhook` are present for real provider integration.

Production payment work should add signed gateway requests, verified callbacks, idempotent webhook processing, payment state transitions, refund requests, and ledger/audit events.
