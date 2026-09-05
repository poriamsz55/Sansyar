package store

import "time"

const (
	CouponPercent = "percent" // value = percent (1..100)
	CouponAmount  = "amount"  // value = rial
)

type (
	// Coupon is a store-wide discount code. Validation happens server-side
	// both when applied to the cart and again at checkout — the cart only
	// remembers the code.
	Coupon struct {
		ID           string    `json:"id" bson:"_id"`
		Code         string    `json:"code" bson:"code"`
		Type         string    `json:"type" bson:"type"`
		Value        int64     `json:"value" bson:"value"`
		MinSubtotal  int64     `json:"min_subtotal" bson:"min_subtotal"`
		MaxDiscount  int64     `json:"max_discount" bson:"max_discount"`
		UsageLimit   int       `json:"usage_limit" bson:"usage_limit"`
		UsedCount    int       `json:"used_count" bson:"used_count"`
		PerUserLimit int       `json:"per_user_limit" bson:"per_user_limit"`
		IsActive     bool      `json:"is_active" bson:"is_active"`
		StartsAt     time.Time `json:"starts_at" bson:"starts_at"`
		ExpiresAt    time.Time `json:"expires_at" bson:"expires_at"`
		CreatedAt    time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt    time.Time `json:"updated_at" bson:"updated_at"`
	}

	// CouponUsage records one redemption (per-user limits + audit).
	CouponUsage struct {
		ID       string    `json:"id" bson:"_id"`
		CouponID string    `json:"coupon_id" bson:"coupon_id"`
		UserID   string    `json:"user_id" bson:"user_id"`
		OrderID  string    `json:"order_id" bson:"order_id"`
		At       time.Time `json:"at" bson:"at"`
	}

	// CouponView is the applied-coupon summary on the cart view.
	CouponView struct {
		Code     string `json:"code"`
		Discount int64  `json:"discount"`
	}

	CreateCouponRequest struct {
		Code         string `json:"code" validate:"required,min=3,max=32"`
		Type         string `json:"type" validate:"required,oneof=percent amount"`
		Value        int64  `json:"value" validate:"required,gt=0"`
		MinSubtotal  int64  `json:"min_subtotal"`
		MaxDiscount  int64  `json:"max_discount"`
		UsageLimit   int    `json:"usage_limit"`
		PerUserLimit int    `json:"per_user_limit"`
		IsActive     *bool  `json:"is_active"`
		StartsAt     string `json:"starts_at"`
		ExpiresAt    string `json:"expires_at"`
	}

	UpdateCouponRequest struct {
		MinSubtotal  *int64  `json:"min_subtotal"`
		MaxDiscount  *int64  `json:"max_discount"`
		UsageLimit   *int    `json:"usage_limit"`
		PerUserLimit *int    `json:"per_user_limit"`
		IsActive     *bool   `json:"is_active"`
		StartsAt     *string `json:"starts_at"`
		ExpiresAt    *string `json:"expires_at"`
	}

	ApplyCouponRequest struct {
		Code string `json:"code" validate:"required,min=1"`
	}
)
