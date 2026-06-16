package booking

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"sansyar/backend/internal/venue"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// effectiveCapacityExpr yields a session's capacity, treating a missing or
// non-positive value (legacy single-slot documents) as 1.
var effectiveCapacityExpr = bson.M{"$cond": bson.A{bson.M{"$gt": bson.A{"$capacity", 0}}, "$capacity", 1}}

type Service struct {
	bookings    *database.Repository[Booking]
	slots       *database.Repository[venue.Slot]
	idempotency *database.Repository[IdempotencyRecord]
}

func NewService(bookings *database.Repository[Booking], slots *database.Repository[venue.Slot], idempotency *database.Repository[IdempotencyRecord]) *Service {
	return &Service{bookings: bookings, slots: slots, idempotency: idempotency}
}

func (s *Service) create(ctx context.Context, customerID string, idempotencyKey string, req CreateBookingRequest) (Booking, error) {
	if idempotencyKey != "" {
		existing, err := s.idempotency.FindOne(ctx, bson.M{"user_id": customerID, "key": idempotencyKey})
		if err == nil && existing.BookingID != "" {
			return s.bookings.FindByID(ctx, existing.BookingID)
		}
	}

	slot, err := s.slots.FindByID(ctx, req.SlotID)
	if errors.Is(err, database.ErrNotFound) {
		return Booking{}, errormap.ErrNotFound
	}
	if err != nil {
		return Booking{}, err
	}
	if slot.StartsAt.Before(time.Now().UTC()) {
		return Booking{}, fmt.Errorf("%w: slot is expired", errormap.ErrConflict)
	}

	bookingID := uuid.NewString()
	now := time.Now().UTC()
	// Multi-capacity sessions take more than one booking. Atomically claim a
	// spot only while the session is open and not yet full. A missing/zero
	// capacity on legacy documents is treated as a single exclusive slot.
	result, err := s.slots.Collection().UpdateOne(ctx,
		bson.M{
			"_id":    req.SlotID,
			"status": venue.SlotAvailable,
			"$expr":  bson.M{"$lt": bson.A{"$booked_count", effectiveCapacityExpr}},
		},
		bson.M{
			"$inc": bson.M{"booked_count": 1},
			"$set": bson.M{"updated_at": now},
		},
	)
	if err != nil {
		return Booking{}, err
	}
	if result.MatchedCount == 0 {
		return Booking{}, fmt.Errorf("%w: session is full or no longer available", errormap.ErrConflict)
	}

	deposit := depositFor(slot, req.PaymentType)
	booking := Booking{
		ID:                         bookingID,
		CustomerID:                 customerID,
		ComplexID:                  slot.ComplexID,
		HallID:                     slot.HallID,
		SportID:                    slot.SportID,
		SlotID:                     slot.ID,
		StartsAt:                   slot.StartsAt,
		EndsAt:                     slot.EndsAt,
		Price:                      slot.BasePrice,
		Discount:                   slot.DiscountPercent,
		FinalAmount:                slot.FinalPrice,
		DepositAmount:              deposit,
		RemainingAmount:            slot.FinalPrice - deposit,
		PaymentType:                req.PaymentType,
		PaymentStatus:              paymentStatusFor(req.PaymentType),
		Status:                     statusFor(req.PaymentType),
		CancellationPolicySnapshot: slot.CancellationPolicySnapshot,
		Timeline:                   []BookingEvent{{At: now, Action: "created", By: customerID}},
		IdempotencyKey:             idempotencyKey,
		CreatedAt:                  now,
		UpdatedAt:                  now,
	}

	if err := s.bookings.Create(ctx, booking); err != nil {
		// Release the claimed spot so capacity is not leaked.
		_, _ = s.slots.Collection().UpdateOne(ctx, bson.M{"_id": req.SlotID}, bson.M{"$inc": bson.M{"booked_count": -1}, "$set": bson.M{"updated_at": time.Now().UTC()}})
		if mongo.IsDuplicateKeyError(err) {
			return Booking{}, fmt.Errorf("%w: you already have a booking for this session", errormap.ErrConflict)
		}
		return Booking{}, err
	}

	if idempotencyKey != "" {
		record := IdempotencyRecord{ID: uuid.NewString(), UserID: customerID, Key: idempotencyKey, BookingID: booking.ID, CreatedAt: now}
		if err := s.idempotency.Create(ctx, record); err != nil && !mongo.IsDuplicateKeyError(err) {
			return Booking{}, err
		}
	}

	return booking, nil
}

func (s *Service) listForCustomer(ctx context.Context, customerID string) ([]Booking, error) {
	return s.bookings.FindAll(ctx, bson.M{"customer_id": customerID}, database.Page{Limit: 100, Sort: bson.D{{Key: "starts_at", Value: -1}}})
}

func (s *Service) listForOwner(ctx context.Context, ownerComplexIDs []string) ([]Booking, error) {
	return s.bookings.FindAll(ctx, bson.M{"complex_id": bson.M{"$in": ownerComplexIDs}}, database.Page{Limit: 200, Sort: bson.D{{Key: "starts_at", Value: 1}}})
}

func (s *Service) cancel(ctx context.Context, customerID string, bookingID string) (Booking, error) {
	item, err := s.bookings.FindByID(ctx, bookingID)
	if errors.Is(err, database.ErrNotFound) {
		return Booking{}, errormap.ErrNotFound
	}
	if err != nil {
		return Booking{}, err
	}
	if item.CustomerID != customerID {
		return Booking{}, errormap.ErrForbidden
	}
	if item.Status != StatusConfirmed && item.Status != StatusAwaitingPayment && item.Status != StatusPending {
		return Booking{}, fmt.Errorf("%w: booking cannot be cancelled from current status", errormap.ErrConflict)
	}

	now := time.Now().UTC()
	decision := CalculateRefund(item.FinalAmount, item.StartsAt, now, 24, 6, 50)
	newStatus := StatusCancelledByUser
	if decision.RefundAmount == item.FinalAmount {
		newStatus = StatusRefunded
	} else if decision.RefundAmount > 0 {
		newStatus = StatusPartiallyRefunded
	}
	event := BookingEvent{At: now, Action: "cancelled_by_user", By: customerID, Note: bookingCancelNote(decision)}
	if err := s.bookings.Update(ctx, bookingID, bson.M{
		"$set":  bson.M{"status": newStatus, "refund_amount": decision.RefundAmount, "cancelled_at": now, "updated_at": now},
		"$push": bson.M{"timeline": event},
	}); err != nil {
		return Booking{}, err
	}
	releaseSpot(ctx, s.slots, item.SlotID, now)
	return s.bookings.FindByID(ctx, bookingID)
}

// bookingCancelNote describes the refund outcome for the audit trail.
func bookingCancelNote(d RefundDecision) string {
	switch d.Mode {
	case "free":
		return "بازپرداخت کامل"
	case "partial":
		return "بازپرداخت جزئی"
	default:
		return "بدون بازپرداخت"
	}
}

// releaseSpot frees one capacity unit on a session when a booking is cancelled,
// never letting booked_count drop below zero.
func releaseSpot(ctx context.Context, slots *database.Repository[venue.Slot], slotID string, now time.Time) {
	_, _ = slots.Collection().UpdateOne(ctx,
		bson.M{"_id": slotID, "booked_count": bson.M{"$gt": 0}},
		bson.M{"$inc": bson.M{"booked_count": -1}, "$set": bson.M{"updated_at": now}},
	)
}

func (s *Service) adminCancel(ctx context.Context, actorID, bookingID, reason string) (Booking, error) {
	item, err := s.bookings.FindByID(ctx, bookingID)
	if errors.Is(err, database.ErrNotFound) {
		return Booking{}, errormap.ErrNotFound
	}
	if err != nil {
		return Booking{}, err
	}
	if item.Status != StatusConfirmed && item.Status != StatusAwaitingPayment && item.Status != StatusPending {
		return Booking{}, fmt.Errorf("%w: booking cannot be cancelled from current status", errormap.ErrConflict)
	}
	now := time.Now().UTC()
	decision := CalculateRefund(item.FinalAmount, item.StartsAt, now, 24, 6, 50)
	event := BookingEvent{At: now, Action: "cancelled_by_admin", By: actorID, Note: reason}
	if err := s.bookings.Update(ctx, bookingID, bson.M{
		"$set":  bson.M{"status": StatusCancelledByOwner, "cancellation_reason": reason, "refund_amount": decision.RefundAmount, "cancelled_at": now, "updated_at": now},
		"$push": bson.M{"timeline": event},
	}); err != nil {
		return Booking{}, err
	}
	releaseSpot(ctx, s.slots, item.SlotID, now)
	return s.bookings.FindByID(ctx, bookingID)
}

func (s *Service) adminConfirm(ctx context.Context, actorID, bookingID string) (Booking, error) {
	item, err := s.bookings.FindByID(ctx, bookingID)
	if errors.Is(err, database.ErrNotFound) {
		return Booking{}, errormap.ErrNotFound
	}
	if err != nil {
		return Booking{}, err
	}
	if item.Status != StatusAwaitingPayment && item.Status != StatusPending {
		return Booking{}, fmt.Errorf("%w: booking cannot be confirmed from current status", errormap.ErrConflict)
	}
	now := time.Now().UTC()
	event := BookingEvent{At: now, Action: "confirmed", By: actorID}
	if err := s.bookings.Update(ctx, bookingID, bson.M{
		"$set":  bson.M{"status": StatusConfirmed, "payment_status": "paid", "updated_at": now},
		"$push": bson.M{"timeline": event},
	}); err != nil {
		return Booking{}, err
	}
	return s.bookings.FindByID(ctx, bookingID)
}

func CalculateRefund(amount int64, startsAt time.Time, cancelledAt time.Time, freeBeforeHours int, partialBeforeHours int, partialRefundPct int) RefundDecision {
	hoursBefore := startsAt.Sub(cancelledAt).Hours()
	if hoursBefore >= float64(freeBeforeHours) {
		return RefundDecision{RefundAmount: amount, FeeAmount: 0, Mode: "free"}
	}
	if hoursBefore >= float64(partialBeforeHours) {
		refund := amount * int64(partialRefundPct) / 100
		return RefundDecision{RefundAmount: refund, FeeAmount: amount - refund, Mode: "partial"}
	}
	return RefundDecision{RefundAmount: 0, FeeAmount: amount, Mode: "none"}
}

func depositFor(slot venue.Slot, paymentType string) int64 {
	switch paymentType {
	case PaymentDeposit:
		if slot.MinDepositAmount > 0 {
			return slot.MinDepositAmount
		}
		return slot.FinalPrice / 2
	case PaymentInPerson:
		return 0
	default:
		return slot.FinalPrice
	}
}

func paymentStatusFor(paymentType string) string {
	switch paymentType {
	case PaymentInPerson:
		return "pay_at_venue"
	case PaymentDeposit:
		return "deposit_paid"
	default:
		return "paid"
	}
}

func statusFor(paymentType string) string {
	if paymentType == PaymentFullOnline || paymentType == PaymentWallet || paymentType == PaymentMixed || paymentType == PaymentInPerson || paymentType == PaymentDeposit {
		return StatusConfirmed
	}
	return StatusAwaitingPayment
}
