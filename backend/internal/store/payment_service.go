package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// InitiateOrderPayment starts (or reuses) a payment attempt for a
// pending_payment order. The amount is taken from the order document — the
// client never supplies it.
func (s *Service) InitiateOrderPayment(ctx context.Context, userID string, orderID string) (OrderPayment, error) {
	order, err := s.orders.FindByID(ctx, orderID)
	if err != nil {
		return OrderPayment{}, mapRepoErr(err)
	}
	if order.UserID != userID {
		return OrderPayment{}, errormap.ErrNotFound
	}
	if order.Status != OrderPendingPayment || order.PaymentStatus != PaymentUnpaid {
		return OrderPayment{}, fmt.Errorf("%w: این سفارش در انتظار پرداخت نیست", errormap.ErrConflict)
	}

	// Reuse a live attempt instead of piling up duplicates.
	existing, err := s.orderPayments.FindOne(ctx, bson.M{"order_id": orderID, "status": PaymentCreated})
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, database.ErrNotFound) {
		return OrderPayment{}, err
	}

	now := time.Now().UTC()
	item := OrderPayment{
		ID: uuid.NewString(), OrderID: orderID, UserID: userID,
		Amount: order.Total, // server-side amount — the only source of truth
		Status: PaymentCreated, Provider: PaymentProviderFake,
		RefID:     "dev-" + uuid.NewString()[:8],
		CreatedAt: now,
	}
	if err := s.orderPayments.Create(ctx, item); err != nil {
		return OrderPayment{}, err
	}
	return item, nil
}

// CompleteOrderPayment simulates the provider callback for the dev gateway.
// Success atomically claims the attempt (created → paid), flips the order to
// paid and appends timeline events; failure just marks the attempt failed so
// the customer can retry.
func (s *Service) CompleteOrderPayment(ctx context.Context, userID string, paymentID string, result string) (Order, OrderPayment, error) {
	payment, err := s.orderPayments.FindByID(ctx, paymentID)
	if err != nil {
		return Order{}, OrderPayment{}, mapRepoErr(err)
	}
	if payment.UserID != userID {
		return Order{}, OrderPayment{}, errormap.ErrNotFound
	}

	order, err := s.orders.FindByID(ctx, payment.OrderID)
	if err != nil {
		return Order{}, OrderPayment{}, mapRepoErr(err)
	}

	if result == "failure" {
		updated, err := s.orderPayments.Collection().UpdateOne(ctx,
			bson.M{"_id": paymentID, "status": PaymentCreated},
			bson.M{"$set": bson.M{"status": PaymentFailed, "failure_reason": "لغو توسط کاربر در درگاه پرداخت", "paid_at": time.Time{}}},
		)
		if err != nil {
			return Order{}, OrderPayment{}, err
		}
		if updated.MatchedCount == 0 {
			return Order{}, OrderPayment{}, fmt.Errorf("%w: این پرداخت قبلاً نهایی شده است", errormap.ErrConflict)
		}
		payment.Status = PaymentFailed
		return order, payment, nil
	}

	// ---- success: claim the payment atomically (double-submit guard) ----
	now := time.Now().UTC()
	claim := bson.M{
		"$set": bson.M{
			"status":         PaymentPaid,
			"paid_at":        now,
			"failure_reason": "",
		},
	}
	updated, err := s.orderPayments.Collection().UpdateOne(ctx,
		bson.M{"_id": paymentID, "status": PaymentCreated},
		claim,
	)
	if err != nil {
		return Order{}, OrderPayment{}, err
	}
	if updated.MatchedCount == 0 {
		return Order{}, OrderPayment{}, fmt.Errorf("%w: این پرداخت قبلاً نهایی شده است", errormap.ErrConflict)
	}

	// Payment verified — flip the order. Only the payment path may perform
	// pending_payment → paid; guard against races with a conditional update.
	orderUpdate, err := s.orders.Collection().UpdateOne(ctx,
		bson.M{"_id": order.ID, "status": OrderPendingPayment, "payment_status": PaymentUnpaid},
		bson.M{
			"$set": bson.M{"status": OrderPaid, "payment_status": PaymentPaid, "updated_at": now},
			"$push": bson.M{"timeline": bson.M{"$each": bson.A{
				OrderEvent{At: now, Action: "payment_paid", By: userID, Note: "پرداخت تأیید شد — مرجع: " + payment.RefID},
				OrderEvent{At: now, Action: "status_paid", By: userID, Note: "سفارش وارد فرآیند پردازش شد"},
			}}},
		},
	)
	if err != nil {
		return Order{}, OrderPayment{}, err
	}
	if orderUpdate.MatchedCount == 0 {
		// The order changed state concurrently (e.g. cancelled while paying).
		// Record the mismatch instead of silently succeeding.
		if _, uerr := s.orderPayments.Collection().UpdateOne(ctx,
			bson.M{"_id": paymentID, "status": PaymentPaid},
			bson.M{"$set": bson.M{"status": PaymentFailed, "failure_reason": "وضعیت سفارش همزمان تغییر کرد", "paid_at": time.Time{}}},
		); uerr != nil {
			return Order{}, OrderPayment{}, uerr
		}
		return Order{}, OrderPayment{}, fmt.Errorf("%w: وضعیت سفارش تغییر کرده است؛ سفارش را دوباره بررسی کنید", errormap.ErrConflict)
	}

	payment.Status = PaymentPaid
	payment.PaidAt = now

	// Stock: convert the reservation into a real sale (reserved -= qty,
	// stock -= qty). Runs once — the conditional update above is the guard.
	s.commitStock(ctx, order)

	updatedOrder, err := s.orders.FindByID(ctx, order.ID)
	return updatedOrder, payment, mapRepoErr(err)
}

// RefundPaidPayments marks all paid payments of an order refunded (used when
// an admin cancels a paid order).
func (s *Service) RefundPaidPayments(ctx context.Context, orderID string) error {
	_, err := s.orderPayments.Collection().UpdateMany(ctx,
		bson.M{"order_id": orderID, "status": PaymentPaid},
		bson.M{"$set": bson.M{"status": PaymentRefunded}},
	)
	return err
}

// MarkOrderPaymentRefunded flips the order's payment_status to refunded.
func (s *Service) MarkOrderPaymentRefunded(ctx context.Context, orderID string) error {
	return mapRepoErr(s.orders.Update(ctx, orderID, bson.M{"$set": bson.M{
		"payment_status": PaymentRefunded, "updated_at": time.Now().UTC(),
	}}))
}
