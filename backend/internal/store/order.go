package store

import "time"

// Order lifecycle. payment transitions arrive with the payment phase; the
// status machine below is enforced server-side on every change.
const (
	OrderPendingPayment = "pending_payment"
	OrderPaid           = "paid"
	OrderProcessing     = "processing"
	OrderShipped        = "shipped"
	OrderDelivered      = "delivered"
	OrderCancelled      = "cancelled"

	PaymentUnpaid = "unpaid"
	PaymentPaid   = "paid"
)

// orderTransitions lists the only legal status changes (from → to).
var orderTransitions = map[string][]string{
	OrderPendingPayment: {OrderCancelled},
	OrderPaid:           {OrderProcessing, OrderCancelled},
	OrderProcessing:     {OrderShipped, OrderCancelled},
	OrderShipped:        {OrderDelivered},
	OrderDelivered:      {},
	OrderCancelled:      {},
}

// CanTransitionOrder reports whether from → to is a legal status change.
func CanTransitionOrder(from, to string) bool {
	if from == to {
		return false
	}
	allowed, ok := orderTransitions[from]
	if !ok {
		return false
	}
	for _, candidate := range allowed {
		if candidate == to {
			return true
		}
	}
	return false
}

type (
	// OrderItem is a full snapshot of one purchased variant. It never changes
	// after creation — later catalog edits (price, name, even deletion)
	// cannot rewrite history.
	OrderItem struct {
		ProductID     string          `json:"product_id" bson:"product_id"`
		VariantID     string          `json:"variant_id" bson:"variant_id"`
		SKU           string          `json:"sku" bson:"sku"`
		ProductName   string          `json:"product_name" bson:"product_name"`
		VariantName   string          `json:"variant_name,omitempty" bson:"variant_name,omitempty"`
		Options       []VariantOption `json:"options,omitempty" bson:"options,omitempty"`
		Image         string          `json:"image,omitempty" bson:"image,omitempty"`
		UnitPrice     int64           `json:"unit_price" bson:"unit_price"`
		OriginalPrice int64           `json:"original_price,omitempty" bson:"original_price,omitempty"`
		Qty           int             `json:"qty" bson:"qty"`
		LineTotal     int64           `json:"line_total" bson:"line_total"`
	}

	// OrderEvent is one entry in the order's audit timeline.
	OrderEvent struct {
		At     time.Time `json:"at" bson:"at"`
		Action string    `json:"action" bson:"action"`
		By     string    `json:"by" bson:"by"`
		Note   string    `json:"note,omitempty" bson:"note,omitempty"`
	}

	// ShippingAddress is the delivery snapshot stored on the order.
	ShippingAddress struct {
		Receiver   string `json:"receiver" bson:"receiver"`
		Phone      string `json:"phone" bson:"phone"`
		Province   string `json:"province" bson:"province"`
		City       string `json:"city" bson:"city"`
		PostalCode string `json:"postal_code" bson:"postal_code"`
		Address    string `json:"address" bson:"address"`
	}

	// ShippingMethodSnapshot records the chosen method and its fee at order
	// time (the live settings may change later).
	ShippingMethodSnapshot struct {
		ID      string `json:"id" bson:"id"`
		Name    string `json:"name" bson:"name"`
		Fee     int64  `json:"fee" bson:"fee"`
		EtaDays int    `json:"eta_days" bson:"eta_days"`
	}

	Order struct {
		ID              string                 `json:"id" bson:"_id"`
		UserID          string                 `json:"user_id" bson:"user_id"`
		Status          string                 `json:"status" bson:"status"`
		PaymentStatus   string                 `json:"payment_status" bson:"payment_status"`
		Items           []OrderItem            `json:"items" bson:"items"`
		Subtotal        int64                  `json:"subtotal" bson:"subtotal"`
		ShippingFee     int64                  `json:"shipping_fee" bson:"shipping_fee"`
		ShippingMethod  ShippingMethodSnapshot `json:"shipping_method" bson:"shipping_method"`
		CouponCode      string                 `json:"coupon_code,omitempty" bson:"coupon_code,omitempty"`
		CouponDiscount  int64                  `json:"coupon_discount" bson:"coupon_discount"`
		Total           int64                  `json:"total" bson:"total"`
		CustomerName    string                 `json:"customer_name" bson:"customer_name"`
		CustomerPhone   string                 `json:"customer_phone" bson:"customer_phone"`
		ShippingAddress ShippingAddress        `json:"shipping_address" bson:"shipping_address"`
		CustomerNote    string                 `json:"customer_note,omitempty" bson:"customer_note,omitempty"`
		TrackingCode    string                 `json:"tracking_code,omitempty" bson:"tracking_code,omitempty"`
		Timeline        []OrderEvent           `json:"timeline" bson:"timeline"`
		IdempotencyKey  string                 `json:"idempotency_key,omitempty" bson:"idempotency_key,omitempty"`
		CreatedAt       time.Time              `json:"created_at" bson:"created_at"`
		UpdatedAt       time.Time              `json:"updated_at" bson:"updated_at"`
	}

	// Address is a saved shipping address on the customer's profile.
	Address struct {
		ID         string    `json:"id" bson:"_id"`
		UserID     string    `json:"user_id" bson:"user_id"`
		Title      string    `json:"title" bson:"title"`
		Receiver   string    `json:"receiver" bson:"receiver"`
		Phone      string    `json:"phone" bson:"phone"`
		Province   string    `json:"province" bson:"province"`
		City       string    `json:"city" bson:"city"`
		PostalCode string    `json:"postal_code" bson:"postal_code"`
		Address    string    `json:"address" bson:"address"`
		IsDefault  bool      `json:"is_default" bson:"is_default"`
		CreatedAt  time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt  time.Time `json:"updated_at" bson:"updated_at"`
	}

	// ShippingMethod is an admin-configured delivery option.
	ShippingMethod struct {
		ID       string `json:"id" bson:"id"`
		Name     string `json:"name" bson:"name"`
		Fee      int64  `json:"fee" bson:"fee"`
		EtaDays  int    `json:"eta_days" bson:"eta_days"`
		IsActive bool   `json:"is_active" bson:"is_active"`
	}

	// StoreSettings is the single settings document (ID "main").
	StoreSettings struct {
		ID              string           `json:"id" bson:"_id"`
		Name            string           `json:"name" bson:"name"`
		Tagline         string           `json:"tagline" bson:"tagline"`
		LogoURL         string           `json:"logo_url" bson:"logo_url"`
		BannerURL       string           `json:"banner_url" bson:"banner_url"`
		SupportPhone    string           `json:"support_phone" bson:"support_phone"`
		IsOpen          bool             `json:"is_open" bson:"is_open"`
		ShippingMethods []ShippingMethod `json:"shipping_methods" bson:"shipping_methods"`
		UpdatedAt       time.Time        `json:"updated_at" bson:"updated_at"`
	}

	PaginatedOrders struct {
		Items []Order `json:"items"`
		Total int64   `json:"total"`
		Page  int     `json:"page"`
		Limit int     `json:"limit"`
	}

	// ---- Requests ----------------------------------------------------------

	CreateAddressRequest struct {
		Title      string `json:"title" validate:"required,min=2"`
		Receiver   string `json:"receiver" validate:"required,min=2"`
		Phone      string `json:"phone" validate:"required,irmobile"`
		Province   string `json:"province" validate:"required"`
		City       string `json:"city" validate:"required"`
		PostalCode string `json:"postal_code"`
		Address    string `json:"address" validate:"required,min=5"`
		IsDefault  bool   `json:"is_default"`
	}

	UpdateAddressRequest struct {
		Title      *string `json:"title"`
		Receiver   *string `json:"receiver"`
		Phone      *string `json:"phone"`
		Province   *string `json:"province"`
		City       *string `json:"city"`
		PostalCode *string `json:"postal_code"`
		Address    *string `json:"address"`
		IsDefault  *bool   `json:"is_default"`
	}

	// CheckoutRequest creates an order from the caller's cart. Address is
	// either a saved address ID or an inline new address (optionally saved).
	CheckoutRequest struct {
		AddressID        string                `json:"address_id"`
		NewAddress       *CreateAddressRequest `json:"new_address"`
		SaveAddress      bool                  `json:"save_address"`
		ShippingMethodID string                `json:"shipping_method_id" validate:"required"`
		CustomerNote     string                `json:"customer_note"`
	}

	UpdateOrderStatusRequest struct {
		Status       string `json:"status" validate:"required"`
		Note         string `json:"note"`
		TrackingCode string `json:"tracking_code"`
	}
)
