package store

import "testing"

func TestComputeCouponDiscount(t *testing.T) {
	// 10% of 5,000,000 rial = 500,000
	got := ComputeCouponDiscount(Coupon{Type: CouponPercent, Value: 10}, 5_000_000)
	if got != 500_000 {
		t.Fatalf("percent: got %d", got)
	}
	// capped at max discount
	got = ComputeCouponDiscount(Coupon{Type: CouponPercent, Value: 50, MaxDiscount: 1_000_000}, 5_000_000)
	if got != 1_000_000 {
		t.Fatalf("cap: got %d", got)
	}
	// amount type never exceeds subtotal
	got = ComputeCouponDiscount(Coupon{Type: CouponAmount, Value: 9_999_999}, 5_000_000)
	if got != 5_000_000 {
		t.Fatalf("amount clamp: got %d", got)
	}
	// zero subtotal -> zero discount
	if got := ComputeCouponDiscount(Coupon{Type: CouponPercent, Value: 10}, 0); got != 0 {
		t.Fatalf("zero subtotal: got %d", got)
	}
}

func TestNormalizeCouponCode(t *testing.T) {
	if got := NormalizeCouponCode(" sport10 "); got != "SPORT10" {
		t.Fatalf("got %q", got)
	}
}
