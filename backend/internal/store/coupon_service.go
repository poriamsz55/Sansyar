package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// NormalizeCouponCode uppercases and strips spaces (codes are ASCII-ish by
// convention; Persian codes are preserved as typed except casing).
func NormalizeCouponCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// ComputeCouponDiscount derives the discount for a subtotal (rial, floor).
func ComputeCouponDiscount(c Coupon, subtotal int64) int64 {
	if subtotal <= 0 {
		return 0
	}
	var discount int64
	if c.Type == CouponPercent {
		discount = subtotal * c.Value / 100
		if c.MaxDiscount > 0 && discount > c.MaxDiscount {
			discount = c.MaxDiscount
		}
	} else {
		discount = c.Value
	}
	if discount > subtotal {
		discount = subtotal
	}
	if discount < 0 {
		discount = 0
	}
	return discount
}

// validateCoupon checks a coupon against the current cart/user; every rule
// is enforced here AND again at checkout (carts only store the code).
func (s *Service) validateCoupon(ctx context.Context, c Coupon, userID string, subtotal int64) error {
	if !c.IsActive {
		return fmt.Errorf("%w: این کد تخفیف فعال نیست", errormap.ErrConflict)
	}
	now := time.Now().UTC()
	if !c.StartsAt.IsZero() && now.Before(c.StartsAt) {
		return fmt.Errorf("%w: این کد تخفیف هنوز فعال نشده است", errormap.ErrConflict)
	}
	if !c.ExpiresAt.IsZero() && now.After(c.ExpiresAt) {
		return fmt.Errorf("%w: این کد تخفیف منقضی شده است", errormap.ErrConflict)
	}
	if c.MinSubtotal > 0 && subtotal < c.MinSubtotal {
		return fmt.Errorf("%w: این کد برای سفارش‌های بالای %s تومان است", errormap.ErrConflict, toman(c.MinSubtotal))
	}
	if c.UsageLimit > 0 && c.UsedCount >= c.UsageLimit {
		return fmt.Errorf("%w: ظرفیت استفاده از این کد تکمیل شده است", errormap.ErrConflict)
	}
	if c.PerUserLimit > 0 && userID != "" {
		used, err := s.couponUsage.Count(ctx, bson.M{"coupon_id": c.ID, "user_id": userID})
		if err != nil {
			return err
		}
		if int(used) >= c.PerUserLimit {
			return fmt.Errorf("%w: شما قبلاً از این کد استفاده کرده‌اید", errormap.ErrConflict)
		}
	}
	return nil
}

func toman(rial int64) string {
	return fmt.Sprintf("%d", rial/10)
}

// ApplyCoupon validates a code against the caller's live cart and remembers
// it on the cart (the discount itself is always recomputed on read).
func (s *Service) ApplyCoupon(ctx context.Context, userID string, token string, code string) (CartView, error) {
	view, err := s.CartView(ctx, userID, token)
	if err != nil {
		return CartView{}, err
	}
	if len(view.Items) == 0 {
		return CartView{}, fmt.Errorf("%w: ابتدا محصولی به سبد اضافه کنید", errormap.ErrConflict)
	}
	normalized := NormalizeCouponCode(code)
	coupon, err := s.coupons.FindOne(ctx, bson.M{"code": normalized})
	if errors.Is(err, database.ErrNotFound) {
		return CartView{}, fmt.Errorf("%w: چنین کد تخفیفی وجود ندارد", errormap.ErrNotFound)
	}
	if err != nil {
		return CartView{}, err
	}
	if err := s.validateCoupon(ctx, coupon, userID, view.Subtotal); err != nil {
		return CartView{}, err
	}
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil || !found {
		return CartView{}, err
	}
	if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"coupon_code": normalized, "updated_at": time.Now().UTC()}}); err != nil {
		return CartView{}, err
	}
	return s.CartView(ctx, userID, token)
}

// RemoveCoupon drops the applied code from the cart.
func (s *Service) RemoveCoupon(ctx context.Context, userID string, token string) (CartView, error) {
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil {
		return CartView{}, err
	}
	if found && cart.CouponCode != "" {
		if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"coupon_code": "", "updated_at": time.Now().UTC()}}); err != nil {
			return CartView{}, err
		}
	}
	return s.CartView(ctx, userID, token)
}

// redeemCoupon finalizes a coupon at checkout: re-validates, atomically
// claims one use (global limit) and records per-user usage.
func (s *Service) redeemCoupon(ctx context.Context, coupon Coupon, userID string, orderID string, subtotal int64) (int64, error) {
	if err := s.validateCoupon(ctx, coupon, userID, subtotal); err != nil {
		return 0, err
	}
	if coupon.UsageLimit > 0 {
		result, err := s.coupons.Collection().UpdateOne(ctx,
			bson.M{"_id": coupon.ID, "$expr": bson.M{"$lt": bson.A{"$used_count", "$usage_limit"}}},
			bson.M{"$inc": bson.M{"used_count": 1}},
		)
		if err != nil {
			return 0, err
		}
		if result.MatchedCount == 0 {
			return 0, fmt.Errorf("%w: ظرفیت استفاده از این کد تکمیل شده است", errormap.ErrConflict)
		}
	} else {
		if _, err := s.coupons.Collection().UpdateOne(ctx,
			bson.M{"_id": coupon.ID}, bson.M{"$inc": bson.M{"used_count": 1}}); err != nil {
			return 0, err
		}
	}
	if userID != "" {
		_ = s.couponUsage.Create(ctx, CouponUsage{
			ID: uuid.NewString(), CouponID: coupon.ID, UserID: userID, OrderID: orderID, At: time.Now().UTC(),
		})
	}
	return ComputeCouponDiscount(coupon, subtotal), nil
}

// ---- Admin CRUD -------------------------------------------------------------

func (s *Service) ListCouponsAdmin(ctx context.Context) ([]Coupon, error) {
	return s.coupons.FindAll(ctx, bson.M{}, database.Page{
		Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}},
	})
}

func (s *Service) CreateCouponAdmin(ctx context.Context, req CreateCouponRequest) (Coupon, error) {
	code := NormalizeCouponCode(req.Code)
	if _, err := s.coupons.FindOne(ctx, bson.M{"code": code}); err == nil {
		return Coupon{}, fmt.Errorf("%w: این کد قبلاً ثبت شده است", errormap.ErrConflict)
	} else if !errors.Is(err, database.ErrNotFound) {
		return Coupon{}, err
	}
	if req.Type == CouponPercent && req.Value > 100 {
		return Coupon{}, fmt.Errorf("%w: درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد", errormap.ErrInvalidInput)
	}
	now := time.Now().UTC()
	item := Coupon{
		ID: uuid.NewString(), Code: code, Type: req.Type, Value: req.Value,
		MinSubtotal: req.MinSubtotal, MaxDiscount: req.MaxDiscount,
		UsageLimit: req.UsageLimit, PerUserLimit: req.PerUserLimit,
		IsActive: req.IsActive == nil || *req.IsActive,
	}
	if req.StartsAt != "" {
		if t, err := time.Parse(time.RFC3339, req.StartsAt); err == nil {
			item.StartsAt = t.UTC()
		}
	}
	if req.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ExpiresAt); err == nil {
			item.ExpiresAt = t.UTC()
		}
	}
	item.CreatedAt, item.UpdatedAt = now, now
	if err := s.coupons.Create(ctx, item); err != nil {
		return Coupon{}, err
	}
	return item, nil
}

func (s *Service) UpdateCouponAdmin(ctx context.Context, id string, req UpdateCouponRequest) (Coupon, error) {
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.MinSubtotal != nil {
		update["min_subtotal"] = *req.MinSubtotal
	}
	if req.MaxDiscount != nil {
		update["max_discount"] = *req.MaxDiscount
	}
	if req.UsageLimit != nil {
		update["usage_limit"] = *req.UsageLimit
	}
	if req.PerUserLimit != nil {
		update["per_user_limit"] = *req.PerUserLimit
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}
	if req.StartsAt != nil && *req.StartsAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.StartsAt); err == nil {
			update["starts_at"] = t.UTC()
		}
	}
	if req.ExpiresAt != nil && *req.ExpiresAt != "" {
		if t, err := time.Parse(time.RFC3339, *req.ExpiresAt); err == nil {
			update["expires_at"] = t.UTC()
		}
	}
	if err := s.coupons.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Coupon{}, mapRepoErr(err)
	}
	item, err := s.coupons.FindByID(ctx, id)
	return item, mapRepoErr(err)
}

func (s *Service) DeleteCouponAdmin(ctx context.Context, id string) error {
	return mapRepoErr(s.coupons.Delete(ctx, id))
}
