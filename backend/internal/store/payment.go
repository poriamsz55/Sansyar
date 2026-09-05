package store

import "time"

// Dev/fake provider: the "gateway" is our own /store/pay/:id page which
// simulates the provider callback. All state transitions still happen
// server-side against the stored amount — never client input.
const (
	PaymentProviderFake = "fake"

	// Note: "paid"/"unpaid" for order.payment_status are PaymentPaid /
	// PaymentUnpaid in order.go. These are payment-attempt states.
	PaymentCreated  = "created"
	PaymentFailed   = "failed"
	PaymentRefunded = "refunded"
)

type (
	// OrderPayment records one payment attempt for an order. The amount is
	// copied from the order at initiation time (server-side) and is the only
	// amount ever accepted by the completion endpoint.
	OrderPayment struct {
		ID            string    `json:"id" bson:"_id"`
		OrderID       string    `json:"order_id" bson:"order_id"`
		UserID        string    `json:"user_id" bson:"user_id"`
		Amount        int64     `json:"amount" bson:"amount"`
		Status        string    `json:"status" bson:"status"`
		Provider      string    `json:"provider" bson:"provider"`
		RefID         string    `json:"ref_id" bson:"ref_id"`
		FailureReason string    `json:"failure_reason,omitempty" bson:"failure_reason,omitempty"`
		CreatedAt     time.Time `json:"created_at" bson:"created_at"`
		PaidAt        time.Time `json:"paid_at,omitempty" bson:"paid_at,omitempty"`
	}

	// CompletePaymentRequest is the simulated provider callback.
	CompletePaymentRequest struct {
		Result string `json:"result" validate:"required,oneof=success failure"`
	}
)
