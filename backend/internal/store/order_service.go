package store

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// SettingsID is the fixed _id of the single store settings document.
const SettingsID = "main"

// ---- Addresses -------------------------------------------------------------

func (s *Service) ListAddresses(ctx context.Context, userID string) ([]Address, error) {
	return s.addresses.FindAll(ctx, bson.M{"user_id": userID}, database.Page{
		Limit: 50, Sort: bson.D{{Key: "is_default", Value: -1}, {Key: "created_at", Value: -1}},
	})
}

func (s *Service) CreateAddress(ctx context.Context, userID string, req CreateAddressRequest) (Address, error) {
	now := time.Now().UTC()
	item := Address{
		ID: uuid.NewString(), UserID: userID, Title: req.Title, Receiver: req.Receiver,
		Phone: req.Phone, Province: req.Province, City: req.City,
		PostalCode: req.PostalCode, Address: req.Address,
		IsDefault: req.IsDefault, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.addresses.Create(ctx, item); err != nil {
		return Address{}, err
	}
	if item.IsDefault {
		if err := s.clearOtherDefaults(ctx, userID, item.ID); err != nil {
			return Address{}, err
		}
	}
	return item, nil
}

func (s *Service) UpdateAddress(ctx context.Context, userID string, id string, req UpdateAddressRequest) (Address, error) {
	existing, err := s.addresses.FindByID(ctx, id)
	if err != nil {
		return Address{}, mapRepoErr(err)
	}
	if existing.UserID != userID {
		return Address{}, errormap.ErrNotFound
	}
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Title != nil {
		update["title"] = *req.Title
	}
	if req.Receiver != nil {
		update["receiver"] = *req.Receiver
	}
	if req.Phone != nil {
		update["phone"] = *req.Phone
	}
	if req.Province != nil {
		update["province"] = *req.Province
	}
	if req.City != nil {
		update["city"] = *req.City
	}
	if req.PostalCode != nil {
		update["postal_code"] = *req.PostalCode
	}
	if req.Address != nil {
		update["address"] = *req.Address
	}
	if req.IsDefault != nil {
		update["is_default"] = *req.IsDefault
	}
	if err := s.addresses.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Address{}, mapRepoErr(err)
	}
	if req.IsDefault != nil && *req.IsDefault {
		if err := s.clearOtherDefaults(ctx, userID, id); err != nil {
			return Address{}, err
		}
	}
	item, err := s.addresses.FindByID(ctx, id)
	return item, mapRepoErr(err)
}

func (s *Service) DeleteAddress(ctx context.Context, userID string, id string) error {
	existing, err := s.addresses.FindByID(ctx, id)
	if err != nil {
		return mapRepoErr(err)
	}
	if existing.UserID != userID {
		return errormap.ErrNotFound
	}
	return mapRepoErr(s.addresses.Delete(ctx, id))
}

func (s *Service) clearOtherDefaults(ctx context.Context, userID string, keepID string) error {
	_, err := s.addresses.Collection().UpdateMany(ctx,
		bson.M{"user_id": userID, "_id": bson.M{"$ne": keepID}, "is_default": true},
		bson.M{"$set": bson.M{"is_default": false, "updated_at": time.Now().UTC()}},
	)
	return err
}

// ---- Settings ---------------------------------------------------------------

// GetSettings returns the store settings, seeding sensible shipping defaults
// the first time they are needed.
func (s *Service) GetSettings(ctx context.Context) (StoreSettings, error) {
	settings, err := s.settings.FindByID(ctx, SettingsID)
	if err == nil {
		return settings, nil
	}
	if !errors.Is(err, database.ErrNotFound) {
		return StoreSettings{}, err
	}
	now := time.Now().UTC()
	defaults := StoreSettings{
		ID:           SettingsID,
		Name:         "فروشگاه ورزشی سانسیار",
		Tagline:      "تجهیزات و پوشاک ورزشی اصل با ارسال سریع",
		SupportPhone: "02100000000",
		IsOpen:       true,
		ShippingMethods: []ShippingMethod{
			{ID: "post", Name: "پست پیشتاز (سراسر کشور)", Fee: 450_000, EtaDays: 4, IsActive: true},
			{ID: "express", Name: "ارسال سریع تهران", Fee: 900_000, EtaDays: 1, IsActive: true},
		},
		UpdatedAt: now,
	}
	if err := s.settings.Create(ctx, defaults); err != nil {
		// Lost a race with another request seeding defaults concurrently.
		return s.settings.FindByID(ctx, SettingsID)
	}
	return defaults, nil
}

// ---- Checkout & orders --------------------------------------------------------

// Checkout turns the caller's cart into a pending_payment order with full
// price/item/address snapshots, then clears the cart.
func (s *Service) Checkout(ctx context.Context, userID string, token string, idempotencyKey string, req CheckoutRequest) (Order, error) {
	if idempotencyKey != "" {
		existing, err := s.orders.FindOne(ctx, bson.M{"user_id": userID, "idempotency_key": idempotencyKey})
		if err == nil {
			return existing, nil
		}
		if !errors.Is(err, database.ErrNotFound) {
			return Order{}, err
		}
	}

	// 1) The cart must be healthy (no unavailable rows, no over-stock rows).
	view, err := s.CartView(ctx, userID, token)
	if err != nil {
		return Order{}, err
	}
	if len(view.Items) == 0 {
		return Order{}, fmt.Errorf("%w: سبد خرید شما خالی است", errormap.ErrConflict)
	}
	if view.HasIssues {
		return Order{}, fmt.Errorf("%w: برخی اقلام سبد ناموجود هستند یا موجودی‌شان کافی نیست", errormap.ErrConflict)
	}

	// 2) Resolve the shipping address (saved or inline new).
	var address Address
	switch {
	case req.AddressID != "":
		saved, err := s.addresses.FindByID(ctx, req.AddressID)
		if err != nil {
			return Order{}, errormap.ErrNotFound
		}
		if saved.UserID != userID {
			return Order{}, errormap.ErrNotFound
		}
		address = saved
	case req.NewAddress != nil:
		address = Address{
			Title: req.NewAddress.Title, Receiver: req.NewAddress.Receiver,
			Phone: req.NewAddress.Phone, Province: req.NewAddress.Province,
			City: req.NewAddress.City, PostalCode: req.NewAddress.PostalCode,
			Address: req.NewAddress.Address,
		}
		if req.SaveAddress {
			saved, err := s.CreateAddress(ctx, userID, *req.NewAddress)
			if err != nil {
				return Order{}, err
			}
			address = saved
		}
	default:
		return Order{}, fmt.Errorf("%w: آدرس ارسال الزامی است", errormap.ErrInvalidInput)
	}

	// 3) Shipping method from the live settings.
	settings, err := s.GetSettings(ctx)
	if err != nil {
		return Order{}, err
	}
	var method ShippingMethod
	found := false
	for _, m := range settings.ShippingMethods {
		if m.ID == req.ShippingMethodID && m.IsActive {
			method, found = m, true
			break
		}
	}
	if !found {
		return Order{}, fmt.Errorf("%w: روش ارسال نامعتبر است", errormap.ErrConflict)
	}

	// 3.5) Redeem the applied coupon (if any) — re-validated and claimed
	// atomically; an expired/invalid code blocks checkout explicitly.
	var couponDiscount int64
	var couponCode string
	if view.Coupon != nil && view.Coupon.Discount > 0 {
		coupon, cerr := s.coupons.FindOne(ctx, bson.M{"code": view.Coupon.Code})
		if cerr != nil {
			return Order{}, fmt.Errorf("%w: کد تخفیف دیگر معتبر نیست؛ آن را از سبد حذف کنید", errormap.ErrConflict)
		}
		discount, rerr := s.redeemCoupon(ctx, coupon, userID, "pending", view.Subtotal)
		if rerr != nil {
			return Order{}, rerr
		}
		couponDiscount, couponCode = discount, coupon.Code
	}

	// 4) Snapshot items and compute totals (all server-side).
	user, err := s.users.FindByID(ctx, userID)
	if err != nil {
		return Order{}, errormap.ErrUnauthorized
	}
	now := time.Now().UTC()
	items := make([]OrderItem, 0, len(view.Items))
	for _, row := range view.Items {
		items = append(items, OrderItem{
			ProductID: row.ProductID, VariantID: row.VariantID, SKU: row.SKU,
			ProductName: row.ProductName, VariantName: row.VariantName,
			Options: row.Options, Image: row.Image,
			UnitPrice: row.UnitPrice, OriginalPrice: row.OriginalPrice,
			Qty: row.Qty, LineTotal: row.LineTotal,
		})
	}
	order := Order{
		ID: uuid.NewString(), UserID: userID,
		Status: OrderPendingPayment, PaymentStatus: PaymentUnpaid,
		Items:          items,
		Subtotal:       view.Subtotal,
		ShippingFee:    method.Fee,
		ShippingMethod: ShippingMethodSnapshot{ID: method.ID, Name: method.Name, Fee: method.Fee, EtaDays: method.EtaDays},
		CouponCode:     couponCode,
		CouponDiscount: couponDiscount,
		Total:          view.Subtotal + method.Fee - couponDiscount,
		CustomerName:   user.FullName,
		CustomerPhone:  user.Phone,
		ShippingAddress: ShippingAddress{
			Receiver: address.Receiver, Phone: address.Phone,
			Province: address.Province, City: address.City,
			PostalCode: address.PostalCode, Address: address.Address,
		},
		CustomerNote:   req.CustomerNote,
		Timeline:       []OrderEvent{{At: now, Action: "created", By: userID}},
		IdempotencyKey: idempotencyKey,
		CreatedAt:      now, UpdatedAt: now,
	}
	if err := s.orders.Create(ctx, order); err != nil {
		return Order{}, err
	}
	// Link the coupon usage to the real order id.
	if couponCode != "" {
		if coupon, cerr := s.coupons.FindOne(ctx, bson.M{"code": couponCode}); cerr == nil {
			_, _ = s.couponUsage.Collection().UpdateMany(ctx,
				bson.M{"coupon_id": coupon.ID, "user_id": userID, "order_id": "pending"},
				bson.M{"$set": bson.M{"order_id": order.ID}},
			)
		}
	}

	// 5) Reserve stock for the whole order; if anything cannot be reserved
	// the order is rolled back and the shopper gets an explicit conflict.
	if err := s.reserveStock(ctx, order); err != nil {
		_ = s.orders.Delete(ctx, order.ID)
		return Order{}, err
	}

	// 6) Empty the cart; the order now owns the items.
	if _, err := s.ClearCart(ctx, userID, token); err != nil {
		return order, err
	}
	return order, nil
}

func (s *Service) ListMyOrders(ctx context.Context, userID string) ([]Order, error) {
	return s.orders.FindAll(ctx, bson.M{"user_id": userID}, database.Page{
		Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}},
	})
}

func (s *Service) GetMyOrder(ctx context.Context, userID string, id string) (Order, error) {
	order, err := s.orders.FindByID(ctx, id)
	if err != nil {
		return Order{}, mapRepoErr(err)
	}
	if order.UserID != userID {
		return Order{}, errormap.ErrNotFound
	}
	return order, nil
}

// CancelMyOrder lets the shopper cancel while payment is still pending.
func (s *Service) CancelMyOrder(ctx context.Context, userID string, id string) (Order, error) {
	order, err := s.GetMyOrder(ctx, userID, id)
	if err != nil {
		return Order{}, err
	}
	if order.Status != OrderPendingPayment {
		return Order{}, fmt.Errorf("%w: این سفارش در وضعیت قابل لغو نیست", errormap.ErrConflict)
	}
	s.releaseStock(ctx, order, userID)
	return s.applyOrderEvent(ctx, order, OrderCancelled, userID, "لغو توسط مشتری")
}

// applyOrderEvent validates the transition, updates status and appends a
// timeline event in one write.
func (s *Service) applyOrderEvent(ctx context.Context, order Order, toStatus string, by string, note string) (Order, error) {
	if !CanTransitionOrder(order.Status, toStatus) {
		return Order{}, fmt.Errorf("%w: تغییر وضعیت از %s به %s مجاز نیست", errormap.ErrConflict, order.Status, toStatus)
	}
	now := time.Now().UTC()
	event := OrderEvent{At: now, Action: "status_" + toStatus, By: by, Note: note}
	if err := s.orders.Update(ctx, order.ID, bson.M{
		"$set":  bson.M{"status": toStatus, "updated_at": now},
		"$push": bson.M{"timeline": event},
	}); err != nil {
		return Order{}, mapRepoErr(err)
	}
	return s.orders.FindByID(ctx, order.ID)
}

// ---- Admin: orders -------------------------------------------------------------

type AdminOrderFilter struct {
	Status        string
	PaymentStatus string
	Q             string
	Page          int
	Limit         int
}

func (s *Service) ListOrdersAdmin(ctx context.Context, f AdminOrderFilter) (PaginatedOrders, error) {
	var result PaginatedOrders
	filter := bson.M{}
	if f.Status != "" {
		filter["status"] = f.Status
	}
	if f.PaymentStatus != "" {
		filter["payment_status"] = f.PaymentStatus
	}
	if q := f.Q; q != "" {
		// Search across order id, customer name and phone.
		filter["$or"] = bson.A{
			bson.M{"_id": bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}},
			bson.M{"customer_name": bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}},
			bson.M{"customer_phone": bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}},
		}
	}
	page, limit := normalizePage(f.Page, f.Limit)
	total, err := s.orders.Count(ctx, filter)
	if err != nil {
		return result, err
	}
	items, err := s.orders.FindAll(ctx, filter, database.Page{
		Limit: int64(limit), Offset: int64((page - 1) * limit),
		Sort: bson.D{{Key: "created_at", Value: -1}},
	})
	if err != nil {
		return result, err
	}
	result = PaginatedOrders{Items: items, Total: total, Page: page, Limit: limit}
	return result, nil
}

func (s *Service) GetOrderAdmin(ctx context.Context, id string) (Order, error) {
	order, err := s.orders.FindByID(ctx, id)
	return order, mapRepoErr(err)
}

// UpdateOrderStatus moves an order along the status machine (admin action);
// a tracking code can be attached when marking the order shipped.
func (s *Service) UpdateOrderStatus(ctx context.Context, id string, toStatus string, actorID string, note string, trackingCode string) (Order, error) {
	order, err := s.orders.FindByID(ctx, id)
	if err != nil {
		return Order{}, mapRepoErr(err)
	}
	if trackingCode != "" {
		if err := s.orders.Update(ctx, order.ID, bson.M{"$set": bson.M{"tracking_code": trackingCode, "updated_at": time.Now().UTC()}}); err != nil {
			return Order{}, mapRepoErr(err)
		}
		order.TrackingCode = trackingCode
	}
	// Cancelling a paid order refunds its payments and returns sold stock.
	if toStatus == OrderCancelled && order.PaymentStatus == PaymentPaid {
		if err := s.RefundPaidPayments(ctx, order.ID); err != nil {
			return Order{}, err
		}
		if err := s.MarkOrderPaymentRefunded(ctx, order.ID); err != nil {
			return Order{}, err
		}
		s.restockStock(ctx, order, actorID)
	}
	// Cancelling an unpaid order releases its reservations.
	if toStatus == OrderCancelled && order.Status == OrderPendingPayment {
		s.releaseStock(ctx, order, actorID)
	}
	return s.applyOrderEvent(ctx, order, toStatus, actorID, note)
}

// StoreStats aggregates the dashboard numbers in one round trip.
type StoreStats struct {
	OrdersTotal     int64 `json:"orders_total"`
	OrdersPending   int64 `json:"orders_pending"`
	OrdersPaid      int64 `json:"orders_paid"`
	OrdersCancelled int64 `json:"orders_cancelled"`
	RevenueTotal    int64 `json:"revenue_total"`
	RevenueToday    int64 `json:"revenue_today"`
	ProductsCount   int64 `json:"products_count"`
	LowStockCount   int64 `json:"low_stock_count"`
}

func (s *Service) StatsAdmin(ctx context.Context) (StoreStats, error) {
	var stats StoreStats
	statusCounts, err := s.orders.Collection().Aggregate(ctx, bson.A{
		bson.M{"$group": bson.M{"_id": "$status", "count": bson.M{"$sum": 1}}},
	})
	if err != nil {
		return stats, err
	}
	var rows []struct {
		ID    string `bson:"_id"`
		Count int64  `bson:"count"`
	}
	if err := statusCounts.All(ctx, &rows); err != nil {
		return stats, err
	}
	for _, r := range rows {
		stats.OrdersTotal += r.Count
		switch r.ID {
		case OrderPendingPayment:
			stats.OrdersPending = r.Count
		case OrderPaid, OrderProcessing, OrderShipped, OrderDelivered:
			stats.OrdersPaid += r.Count
		case OrderCancelled:
			stats.OrdersCancelled = r.Count
		}
	}

	revenue, err := s.orders.Collection().Aggregate(ctx, bson.A{
		// paid at some point = payment_status paid or refunded (refunds were
		// real money before cancellation)
		bson.M{"$match": bson.M{"payment_status": bson.M{"$in": bson.A{PaymentPaid, "refunded"}}}},
		bson.M{"$group": bson.M{
			"_id":   nil,
			"total": bson.M{"$sum": "$total"},
			"today": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$gte": bson.A{"$created_at", todayStart()}}, "$total", 0,
			}}},
		}},
	})
	if err != nil {
		return stats, err
	}
	var revRows []struct {
		Total int64 `bson:"total"`
		Today int64 `bson:"today"`
	}
	if err := revenue.All(ctx, &revRows); err != nil {
		return stats, err
	}
	if len(revRows) > 0 {
		stats.RevenueTotal, stats.RevenueToday = revRows[0].Total, revRows[0].Today
	}

	if stats.ProductsCount, err = s.products.Count(ctx, bson.M{}); err != nil {
		return stats, err
	}
	low, err := s.variants.Collection().CountDocuments(ctx, bson.M{"$expr": bson.M{"$lte": bson.A{
		bson.M{"$subtract": bson.A{"$stock", "$reserved"}}, 3,
	}}})
	if err != nil {
		return stats, err
	}
	stats.LowStockCount = low
	return stats, nil
}

func todayStart() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

// UpdateSettingsAdmin replaces editable settings fields.
type UpdateSettingsRequest struct {
	Name            *string          `json:"name"`
	Tagline         *string          `json:"tagline"`
	LogoURL         *string          `json:"logo_url"`
	BannerURL       *string          `json:"banner_url"`
	SupportPhone    *string          `json:"support_phone"`
	IsOpen          *bool            `json:"is_open"`
	ShippingMethods []ShippingMethod `json:"shipping_methods"`
}

func (s *Service) UpdateSettingsAdmin(ctx context.Context, req UpdateSettingsRequest) (StoreSettings, error) {
	if _, err := s.GetSettings(ctx); err != nil {
		return StoreSettings{}, err
	}
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != nil {
		update["name"] = *req.Name
	}
	if req.Tagline != nil {
		update["tagline"] = *req.Tagline
	}
	if req.LogoURL != nil {
		update["logo_url"] = *req.LogoURL
	}
	if req.BannerURL != nil {
		update["banner_url"] = *req.BannerURL
	}
	if req.SupportPhone != nil {
		update["support_phone"] = *req.SupportPhone
	}
	if req.IsOpen != nil {
		update["is_open"] = *req.IsOpen
	}
	if req.ShippingMethods != nil {
		// at least one active method with a valid id/name
		for _, m := range req.ShippingMethods {
			if m.ID == "" || m.Name == "" {
				return StoreSettings{}, fmt.Errorf("%w: روش ارسال باید شناسه و نام داشته باشد", errormap.ErrInvalidInput)
			}
		}
		update["shipping_methods"] = req.ShippingMethods
	}
	if err := s.settings.Update(ctx, SettingsID, bson.M{"$set": update}); err != nil {
		return StoreSettings{}, mapRepoErr(err)
	}
	return s.GetSettings(ctx)
}

// StoreCustomer is one row of the customers view (aggregated from orders).
type StoreCustomer struct {
	UserID      string    `json:"user_id" bson:"_id"`
	Name        string    `json:"name" bson:"name"`
	Phone       string    `json:"phone" bson:"phone"`
	OrdersCount int       `json:"orders_count" bson:"orders_count"`
	TotalSpent  int64     `json:"total_spent" bson:"total_spent"`
	LastOrderAt time.Time `json:"last_order_at" bson:"last_order_at"`
}

func (s *Service) ListCustomersAdmin(ctx context.Context) ([]StoreCustomer, error) {
	cursor, err := s.orders.Collection().Aggregate(ctx, bson.A{
		bson.M{"$group": bson.M{
			"_id":          "$user_id",
			"name":         bson.M{"$first": "$customer_name"},
			"phone":        bson.M{"$first": "$customer_phone"},
			"orders_count": bson.M{"$sum": 1},
			"total_spent": bson.M{"$sum": bson.M{"$cond": bson.A{
				bson.M{"$in": bson.A{"$payment_status", bson.A{PaymentPaid, "refunded"}}}, "$total", 0,
			}}},
			"last_order_at": bson.M{"$max": "$created_at"},
		}},
		bson.M{"$sort": bson.M{"last_order_at": -1}},
		bson.M{"$limit": 100},
	})
	if err != nil {
		return nil, err
	}
	var rows []StoreCustomer
	return rows, cursor.All(ctx, &rows)
}
