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

// maxCartQty caps a single variant's quantity in one cart.
const maxCartQty = 99

// resolveCart finds (and for logged-in shoppers optionally merges the guest
// cart into) the caller's cart. It returns the cart and whether one exists;
// carts are created lazily on the first add.
func (s *Service) resolveCart(ctx context.Context, userID string, token string, mergeGuest bool) (Cart, bool, error) {
	if userID != "" {
		cart, err := s.carts.FindOne(ctx, bson.M{"user_id": userID})
		if err != nil && !errors.Is(err, database.ErrNotFound) {
			return Cart{}, false, err
		}
		found := !errors.Is(err, database.ErrNotFound)

		// A guest cart riding along on the first authenticated request gets
		// merged into (or becomes) the user's cart.
		if mergeGuest && token != "" {
			guest, gerr := s.carts.FindOne(ctx, bson.M{"token": token})
			if gerr != nil && !errors.Is(gerr, database.ErrNotFound) {
				return Cart{}, false, gerr
			}
			if gerr == nil {
				if !found {
					// Promote the guest cart to the user's cart.
					guest.UserID = userID
					guest.Token = ""
					guest.UpdatedAt = time.Now().UTC()
					if err := s.carts.Update(ctx, guest.ID, bson.M{"$set": bson.M{"user_id": userID, "token": "", "updated_at": guest.UpdatedAt}}); err != nil {
						return Cart{}, false, err
					}
					return guest, true, nil
				}
				merged := mergeItems(cart.Items, guest.Items)
				update := bson.M{"items": merged, "updated_at": time.Now().UTC()}
				if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": update}); err != nil {
					return Cart{}, false, err
				}
				if err := s.carts.Delete(ctx, guest.ID); err != nil {
					return Cart{}, false, err
				}
				cart.Items = merged
				return cart, true, nil
			}
		}
		return cart, found, nil
	}

	if token != "" {
		cart, err := s.carts.FindOne(ctx, bson.M{"token": token})
		if errors.Is(err, database.ErrNotFound) {
			return Cart{}, false, nil
		}
		if err != nil {
			return Cart{}, false, err
		}
		return cart, true, nil
	}
	return Cart{}, false, nil
}

// mergeItems unions two item lists, summing quantities of the same variant
// and capping at maxCartQty.
func mergeItems(a, b []CartItem) []CartItem {
	byVariant := make(map[string]int, len(a)+len(b))
	order := make([]string, 0, len(a)+len(b))
	for _, list := range [][]CartItem{a, b} {
		for _, item := range list {
			if _, seen := byVariant[item.VariantID]; !seen {
				order = append(order, item.VariantID)
			}
			byVariant[item.VariantID] += item.Qty
		}
	}
	merged := make([]CartItem, 0, len(order))
	for _, vid := range order {
		qty := byVariant[vid]
		if qty > maxCartQty {
			qty = maxCartQty
		}
		merged = append(merged, CartItem{VariantID: vid, Qty: qty})
	}
	return merged
}

// CartView renders the caller's cart with live catalog prices. The cart
// document stores only variant references and quantities; every price, name,
// image and stock figure is resolved fresh — the client can never inject
// totals.
func (s *Service) CartView(ctx context.Context, userID string, token string) (CartView, error) {
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil {
		return CartView{}, err
	}
	view := CartView{Items: []CartItemView{}}
	if !found || len(cart.Items) == 0 {
		return view, nil
	}
	view.ID = cart.ID
	view.Items, view.Subtotal, view.ItemCount, view.HasIssues, err = s.resolveCartItems(ctx, cart.Items)
	if err != nil {
		return CartView{}, err
	}
	view.Total = view.Subtotal

	// Applied coupon: re-validated on every read; the discount is always
	// computed fresh (the cart stores only the code).
	if cart.CouponCode != "" {
		coupon, cerr := s.coupons.FindOne(ctx, bson.M{"code": cart.CouponCode})
		if cerr == nil {
			if verr := s.validateCoupon(ctx, coupon, userID, view.Subtotal); verr == nil {
				view.Coupon = &CouponView{Code: coupon.Code, Discount: ComputeCouponDiscount(coupon, view.Subtotal)}
				view.Discount = view.Coupon.Discount
				view.Total = view.Subtotal - view.Discount
			} else {
				view.Coupon = &CouponView{Code: coupon.Code}
			}
		}
	}
	return view, nil
}

// resolveCartItems joins stored items with live variants/products. Rows whose
// variant or product is no longer sellable are flagged Unavailable and
// excluded from the subtotal.
func (s *Service) resolveCartItems(ctx context.Context, items []CartItem) ([]CartItemView, int64, int, bool, error) {
	variantIDs := make(bson.A, 0, len(items))
	for _, item := range items {
		variantIDs = append(variantIDs, item.VariantID)
	}
	variants, err := s.variants.FindAll(ctx, bson.M{"_id": bson.M{"$in": variantIDs}}, database.Page{Limit: 100})
	if err != nil {
		return nil, 0, 0, false, err
	}
	variantByID := make(map[string]ProductVariant, len(variants))
	for _, v := range variants {
		variantByID[v.ID] = v
	}

	productIDs := make(bson.A, 0, len(items))
	for _, v := range variants {
		productIDs = append(productIDs, v.ProductID)
	}
	products, err := s.products.FindAll(ctx, bson.M{"_id": bson.M{"$in": productIDs}}, database.Page{Limit: 100})
	if err != nil {
		return nil, 0, 0, false, err
	}
	productByID := make(map[string]Product, len(products))
	for _, p := range products {
		productByID[p.ID] = p
	}

	rows := make([]CartItemView, 0, len(items))
	var subtotal int64
	itemCount := 0
	hasIssues := false
	for _, item := range items {
		row := CartItemView{
			VariantID: item.VariantID,
			Qty:       item.Qty,
		}
		variant, vOK := variantByID[item.VariantID]
		product, pOK := productByID[variant.ProductID]
		if !vOK || !pOK || !variant.IsActive || product.Status != ProductPublished || !product.IsActive {
			// Keep the row visible (so the shopper can remove it) but flag it.
			row.Unavailable = true
			if vOK {
				row.ProductID = variant.ProductID
				row.ProductName = variant.Name
				row.SKU = variant.SKU
				row.VariantName = variantDisplayName(variant.Name, variant.Options)
			} else {
				row.ProductName = "محصول حذف‌شده"
			}
			hasIssues = true
			rows = append(rows, row)
			continue
		}

		row.ProductID = product.ID
		row.ProductName = product.Name
		row.Slug = product.Slug
		row.SKU = variant.SKU
		row.Options = variant.Options
		if variant.Name != VariantDefaultName || len(variant.Options) > 0 {
			row.VariantName = variantDisplayName(variant.Name, variant.Options)
		}
		row.Image = primaryImage(product.Images)
		row.UnitPrice = variant.Price
		row.OriginalPrice = variant.OriginalPrice
		row.Available = variant.Stock - variant.Reserved
		if row.Available < 0 {
			row.Available = 0
		}
		row.LineTotal = variant.Price * int64(item.Qty)
		if item.Qty > row.Available {
			hasIssues = true
		}
		subtotal += row.LineTotal
		itemCount += item.Qty
		rows = append(rows, row)
	}
	return rows, subtotal, itemCount, hasIssues, nil
}

// AddToCart adds a variant to the caller's cart (creating the cart when it is
// the first item) after validating it is currently sellable.
func (s *Service) AddToCart(ctx context.Context, userID string, token string, req AddCartItemRequest) (CartView, string, error) {
	variant, err := s.variants.FindByID(ctx, req.VariantID)
	if errors.Is(err, database.ErrNotFound) {
		return CartView{}, "", errormap.ErrNotFound
	}
	if err != nil {
		return CartView{}, "", err
	}
	if !variant.IsActive {
		return CartView{}, "", fmt.Errorf("%w: این گونه دیگر قابل فروش نیست", errormap.ErrConflict)
	}
	product, err := s.products.FindByID(ctx, variant.ProductID)
	if errors.Is(err, database.ErrNotFound) {
		return CartView{}, "", errormap.ErrNotFound
	}
	if err != nil {
		return CartView{}, "", err
	}
	if product.Status != ProductPublished || !product.IsActive {
		return CartView{}, "", fmt.Errorf("%w: این محصول دیگر قابل فروش نیست", errormap.ErrConflict)
	}
	available := variant.Stock - variant.Reserved
	if available <= 0 {
		return CartView{}, "", fmt.Errorf("%w: موجودی این گونه به پایان رسیده است", errormap.ErrConflict)
	}
	if req.Qty > available {
		return CartView{}, "", fmt.Errorf("%w: تنها %d عدد از این گونه موجود است", errormap.ErrConflict, available)
	}

	cart, found, err := s.resolveCart(ctx, userID, token, true)
	if err != nil {
		return CartView{}, "", err
	}
	now := time.Now().UTC()
	newToken := ""
	if !found {
		cart = Cart{ID: uuid.NewString(), Items: []CartItem{}, CreatedAt: now}
		if userID != "" {
			cart.UserID = userID
		} else {
			// The caller must supply a token; generate one for brand-new
			// guest carts and hand it back.
			newToken = token
			if newToken == "" {
				newToken = uuid.NewString()
			}
			cart.Token = newToken
		}
		cart.Items = []CartItem{{VariantID: variant.ID, ProductID: product.ID, Qty: req.Qty, AddedAt: now}}
		cart.UpdatedAt = now
		if err := s.carts.Create(ctx, cart); err != nil {
			return CartView{}, "", err
		}
	} else {
		items := cart.Items
		if items == nil {
			items = []CartItem{}
		}
		target := -1
		total := 0
		for i := range items {
			if items[i].VariantID == variant.ID {
				target = i
				total = items[i].Qty
				break
			}
		}
		total += req.Qty
		if total > available {
			return CartView{}, "", fmt.Errorf("%w: تنها %d عدد از این گونه موجود است (سبد شما: %d)", errormap.ErrConflict, available, total-req.Qty)
		}
		if total > maxCartQty {
			total = maxCartQty
		}
		if target >= 0 {
			items[target].Qty = total
		} else {
			items = append(items, CartItem{VariantID: variant.ID, ProductID: product.ID, Qty: total, AddedAt: now})
		}
		if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"items": items, "updated_at": now}}); err != nil {
			return CartView{}, "", err
		}
		cart.Items = items
	}

	view, err := s.CartView(ctx, userID, cartTokenOf(cart, token))
	if err != nil {
		return CartView{}, "", err
	}
	return view, newToken, nil
}

// SetCartItemQty sets the exact quantity of one variant in the cart.
func (s *Service) SetCartItemQty(ctx context.Context, userID string, token string, variantID string, qty int) (CartView, error) {
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil {
		return CartView{}, err
	}
	if !found {
		return CartView{}, errormap.ErrNotFound
	}

	target := -1
	for i := range cart.Items {
		if cart.Items[i].VariantID == variantID {
			target = i
			break
		}
	}
	if target < 0 {
		return CartView{}, errormap.ErrNotFound
	}

	variant, err := s.variants.FindByID(ctx, variantID)
	if err == nil {
		available := variant.Stock - variant.Reserved
		if qty > available {
			return CartView{}, fmt.Errorf("%w: تنها %d عدد از این گونه موجود است", errormap.ErrConflict, max(available, 0))
		}
	}
	cart.Items[target].Qty = qty
	if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"items": cart.Items, "updated_at": time.Now().UTC()}}); err != nil {
		return CartView{}, err
	}
	return s.CartView(ctx, userID, cartTokenOf(cart, token))
}

// RemoveCartItem removes one variant row from the cart.
func (s *Service) RemoveCartItem(ctx context.Context, userID string, token string, variantID string) (CartView, error) {
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil {
		return CartView{}, err
	}
	if !found {
		return CartView{}, errormap.ErrNotFound
	}
	items := make([]CartItem, 0, len(cart.Items))
	for _, item := range cart.Items {
		if item.VariantID != variantID {
			items = append(items, item)
		}
	}
	if len(items) == len(cart.Items) {
		return CartView{}, errormap.ErrNotFound
	}
	if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"items": items, "updated_at": time.Now().UTC()}}); err != nil {
		return CartView{}, err
	}
	return s.CartView(ctx, userID, cartTokenOf(cart, token))
}

// ClearCart empties the cart (keeps the document so the token stays stable).
func (s *Service) ClearCart(ctx context.Context, userID string, token string) (CartView, error) {
	cart, found, err := s.resolveCart(ctx, userID, token, userID != "")
	if err != nil {
		return CartView{}, err
	}
	if found {
		if err := s.carts.Update(ctx, cart.ID, bson.M{"$set": bson.M{"items": []CartItem{}, "coupon_code": "", "updated_at": time.Now().UTC()}}); err != nil {
			return CartView{}, err
		}
	}
	return s.CartView(ctx, userID, cartTokenOf(cart, token))
}

// cartTokenOf returns the token that identifies this cart for a guest
// (empty for user carts).
func cartTokenOf(cart Cart, fallback string) string {
	if cart.Token != "" {
		return cart.Token
	}
	return fallback
}
