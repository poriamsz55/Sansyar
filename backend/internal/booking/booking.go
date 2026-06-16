package booking

import "time"

const (
	StatusPending           = "pending"
	StatusAwaitingPayment   = "awaiting_payment"
	StatusConfirmed         = "confirmed"
	StatusCancelledByUser   = "cancelled_by_user"
	StatusCancelledByOwner  = "cancelled_by_owner"
	StatusExpired           = "expired"
	StatusCompleted         = "completed"
	StatusNoShow            = "no_show"
	StatusRefunded          = "refunded"
	StatusPartiallyRefunded = "partially_refunded"

	PaymentFullOnline = "full_online"
	PaymentDeposit    = "deposit_online_remaining_in_person"
	PaymentInPerson   = "full_in_person"
	PaymentWallet     = "wallet"
	PaymentMixed      = "mixed"
)

type (
	// BookingEvent is one entry in a booking's audit trail / timeline.
	BookingEvent struct {
		At     time.Time `json:"at" bson:"at"`
		Action string    `json:"action" bson:"action"`
		By     string    `json:"by" bson:"by"`
		Note   string    `json:"note,omitempty" bson:"note,omitempty"`
	}

	Booking struct {
		ID                         string         `json:"id" bson:"_id"`
		CustomerID                 string         `json:"customer_id" bson:"customer_id"`
		ComplexID                  string         `json:"complex_id" bson:"complex_id"`
		HallID                     string         `json:"hall_id" bson:"hall_id"`
		SportID                    string         `json:"sport_id" bson:"sport_id"`
		SlotID                     string         `json:"slot_id" bson:"slot_id"`
		StartsAt                   time.Time      `json:"starts_at" bson:"starts_at"`
		EndsAt                     time.Time      `json:"ends_at" bson:"ends_at"`
		Price                      int64          `json:"price" bson:"price"`
		Discount                   int            `json:"discount" bson:"discount"`
		CouponCode                 string         `json:"coupon_code,omitempty" bson:"coupon_code,omitempty"`
		FinalAmount                int64          `json:"final_amount" bson:"final_amount"`
		DepositAmount              int64          `json:"deposit_amount" bson:"deposit_amount"`
		RemainingAmount            int64          `json:"remaining_amount" bson:"remaining_amount"`
		RefundAmount               int64          `json:"refund_amount" bson:"refund_amount"`
		PaymentType                string         `json:"payment_type" bson:"payment_type"`
		PaymentStatus              string         `json:"payment_status" bson:"payment_status"`
		Status                     string         `json:"status" bson:"status"`
		Notes                      string         `json:"notes,omitempty" bson:"notes,omitempty"`
		CancellationReason         string         `json:"cancellation_reason,omitempty" bson:"cancellation_reason,omitempty"`
		CancelledAt                *time.Time     `json:"cancelled_at,omitempty" bson:"cancelled_at,omitempty"`
		CancellationPolicySnapshot any            `json:"cancellation_policy_snapshot" bson:"cancellation_policy_snapshot"`
		Timeline                   []BookingEvent `json:"timeline,omitempty" bson:"timeline,omitempty"`
		IdempotencyKey             string         `json:"idempotency_key" bson:"idempotency_key"`
		CreatedAt                  time.Time      `json:"created_at" bson:"created_at"`
		UpdatedAt                  time.Time      `json:"updated_at" bson:"updated_at"`
	}

	IdempotencyRecord struct {
		ID        string    `json:"id" bson:"_id"`
		UserID    string    `json:"user_id" bson:"user_id"`
		Key       string    `json:"key" bson:"key"`
		BookingID string    `json:"booking_id" bson:"booking_id"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
	}

	CreateBookingRequest struct {
		SlotID      string `json:"slot_id" validate:"required"`
		PaymentType string `json:"payment_type" validate:"required"`
	}

	CancelBookingRequest struct {
		Reason string `json:"reason"`
	}

	RefundDecision struct {
		RefundAmount int64  `json:"refund_amount"`
		FeeAmount    int64  `json:"fee_amount"`
		Mode         string `json:"mode"`
	}
)
