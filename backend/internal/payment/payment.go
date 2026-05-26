package payment

import "time"

const (
	StatusUnpaid            = "unpaid"
	StatusDepositPaid       = "deposit_paid"
	StatusPaid              = "paid"
	StatusFailed            = "failed"
	StatusRefunded          = "refunded"
	StatusPartiallyRefunded = "partially_refunded"
	StatusPayAtVenue        = "pay_at_venue"
)

type (
	Payment struct {
		ID         string    `json:"id" bson:"_id"`
		BookingID  string    `json:"booking_id" bson:"booking_id"`
		UserID     string    `json:"user_id" bson:"user_id"`
		Amount     int64     `json:"amount" bson:"amount"`
		Status     string    `json:"status" bson:"status"`
		Provider   string    `json:"provider" bson:"provider"`
		RefID      string    `json:"ref_id" bson:"ref_id"`
		CreatedAt  time.Time `json:"created_at" bson:"created_at"`
		VerifiedAt time.Time `json:"verified_at,omitempty" bson:"verified_at,omitempty"`
	}

	InitiateRequest struct {
		BookingID string `json:"booking_id" validate:"required"`
		Amount    int64  `json:"amount" validate:"required"`
		Method    string `json:"method" validate:"required"`
	}
)
