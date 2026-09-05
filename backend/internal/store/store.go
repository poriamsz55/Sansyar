package store

import "time"

// Product lifecycle. A product is visible in the storefront only while it is
// published and active.
const (
	ProductDraft     = "draft"
	ProductPublished = "published"

	// VariantDefaultName marks the implicit variant every product is created
	// with. Products without size/color options keep exactly this one variant;
	// the admin product form edits its price/stock until real variants are
	// added in the catalog phase.
	VariantDefaultName = "default"

	// CartTokenHeader identifies a guest cart across requests until the
	// shopper logs in (or forever, for shoppers who never log in).
	CartTokenHeader = "X-Cart-Token"
)

type (
	Category struct {
		ID        string    `json:"id" bson:"_id"`
		Name      string    `json:"name" bson:"name"`
		Slug      string    `json:"slug" bson:"slug"`
		Icon      string    `json:"icon,omitempty" bson:"icon,omitempty"`
		IsActive  bool      `json:"is_active" bson:"is_active"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	}

	Brand struct {
		ID        string    `json:"id" bson:"_id"`
		Name      string    `json:"name" bson:"name"`
		Slug      string    `json:"slug" bson:"slug"`
		LogoURL   string    `json:"logo_url,omitempty" bson:"logo_url,omitempty"`
		IsActive  bool      `json:"is_active" bson:"is_active"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	}

	// ProductImage is embedded on the product document. At most one image is
	// primary; normalisation on write guarantees that (first primary wins, else
	// the first image becomes primary).
	ProductImage struct {
		URL       string `json:"url" bson:"url"`
		Alt       string `json:"alt,omitempty" bson:"alt,omitempty"`
		IsPrimary bool   `json:"is_primary" bson:"is_primary"`
	}

	// ProductAttribute is a free-form specification row (e.g. جنس: چرم).
	ProductAttribute struct {
		Key   string `json:"key" bson:"key"`
		Value string `json:"value" bson:"value"`
	}

	Product struct {
		ID          string             `json:"id" bson:"_id"`
		Name        string             `json:"name" bson:"name"`
		Slug        string             `json:"slug" bson:"slug"`
		Description string             `json:"description,omitempty" bson:"description,omitempty"`
		CategoryID  string             `json:"category_id,omitempty" bson:"category_id,omitempty"`
		BrandID     string             `json:"brand_id,omitempty" bson:"brand_id,omitempty"`
		Images      []ProductImage     `json:"images" bson:"images"`
		Attributes  []ProductAttribute `json:"attributes" bson:"attributes"`
		Status      string             `json:"status" bson:"status"`
		IsActive    bool               `json:"is_active" bson:"is_active"`
		CreatedAt   time.Time          `json:"created_at" bson:"created_at"`
		UpdatedAt   time.Time          `json:"updated_at" bson:"updated_at"`
	}

	// VariantOption is one selectable axis of a variant (e.g. سایز=۴۲).
	VariantOption struct {
		Key   string `json:"key" bson:"key"`
		Value string `json:"value" bson:"value"`
	}

	// ProductVariant lives in its own collection (not embedded) so stock
	// reservation is a single atomic conditional update per variant — the same
	// pattern time-slot claiming uses. Available stock is Stock - Reserved.
	ProductVariant struct {
		ID            string          `json:"id" bson:"_id"`
		ProductID     string          `json:"product_id" bson:"product_id"`
		Name          string          `json:"name,omitempty" bson:"name,omitempty"`
		Options       []VariantOption `json:"options" bson:"options"`
		SKU           string          `json:"sku" bson:"sku"`
		Price         int64           `json:"price" bson:"price"`
		OriginalPrice int64           `json:"original_price,omitempty" bson:"original_price,omitempty"`
		Stock         int             `json:"stock" bson:"stock"`
		Reserved      int             `json:"reserved" bson:"reserved"`
		IsActive      bool            `json:"is_active" bson:"is_active"`
		CreatedAt     time.Time       `json:"created_at" bson:"created_at"`
		UpdatedAt     time.Time       `json:"updated_at" bson:"updated_at"`
	}

	// VariantSummary is the denormalised pricing/stock view of a product's
	// variants, computed at read time (never stored, so it can never drift).
	VariantSummary struct {
		PriceFrom      int64 `json:"price_from"`
		OriginalFrom   int64 `json:"original_from"`
		DiscountMax    int   `json:"discount_max"`
		TotalStock     int   `json:"total_stock"`
		AvailableStock int   `json:"available_stock"`
		VariantCount   int   `json:"variant_count"`
	}

	// ProductListItem is a storefront/admin row: the product plus its live
	// variant summary and the resolved primary image.
	ProductListItem struct {
		Product
		VariantSummary
		PrimaryImage string `json:"primary_image"`
	}

	// ProductDetail is a single product page payload: product, its active
	// variants, and resolved category/brand for display.
	ProductDetail struct {
		Product
		VariantSummary
		Variants []ProductVariant `json:"variants"`
		Category *Category        `json:"category,omitempty"`
		Brand    *Brand           `json:"brand,omitempty"`
	}

	PaginatedProducts struct {
		Items []ProductListItem `json:"items"`
		Total int64             `json:"total"`
		Page  int               `json:"page"`
		Limit int               `json:"limit"`
	}

	// ---- Cart ---------------------------------------------------------------

	// CartItem references a variant by ID plus the chosen quantity. Prices,
	// names and stock are NEVER trusted from this document — they are resolved
	// live from the catalog on every cart read.
	CartItem struct {
		VariantID string    `json:"variant_id" bson:"variant_id"`
		ProductID string    `json:"product_id" bson:"product_id"`
		Qty       int       `json:"qty" bson:"qty"`
		AddedAt   time.Time `json:"added_at" bson:"added_at"`
	}

	// Cart belongs to a logged-in customer (UserID) or an anonymous shopper
	// (Token). Exactly one of the two is set; guest carts merge into the
	// user's cart on login.
	Cart struct {
		ID         string     `json:"id" bson:"_id"`
		UserID     string     `json:"user_id,omitempty" bson:"user_id,omitempty"`
		Token      string     `json:"-" bson:"token,omitempty"`
		Items      []CartItem `json:"items" bson:"items"`
		CouponCode string     `json:"coupon_code,omitempty" bson:"coupon_code,omitempty"`
		CreatedAt  time.Time  `json:"created_at" bson:"created_at"`
		UpdatedAt  time.Time  `json:"updated_at" bson:"updated_at"`
	}

	// CartItemView is one rendered cart row: live catalog data joined with the
	// stored quantity. LineTotal is server-computed.
	CartItemView struct {
		VariantID     string          `json:"variant_id"`
		ProductID     string          `json:"product_id"`
		ProductName   string          `json:"product_name"`
		VariantName   string          `json:"variant_name,omitempty"`
		Options       []VariantOption `json:"options,omitempty"`
		SKU           string          `json:"sku"`
		Image         string          `json:"image,omitempty"`
		Slug          string          `json:"slug"`
		UnitPrice     int64           `json:"unit_price"`
		OriginalPrice int64           `json:"original_price,omitempty"`
		Qty           int             `json:"qty"`
		LineTotal     int64           `json:"line_total"`
		// Available is the variant's current sellable stock (may be lower than
		// Qty or zero — the UI must warn/block checkout for such rows).
		Available   int  `json:"available"`
		Unavailable bool `json:"unavailable"` // variant/product no longer sellable
	}

	CartView struct {
		ID        string         `json:"id"`
		Items     []CartItemView `json:"items"`
		ItemCount int            `json:"item_count"` // total quantity, not rows
		Subtotal  int64          `json:"subtotal"`
		Discount  int64          `json:"discount"`
		Total     int64          `json:"total"` // subtotal - discount
		Coupon    *CouponView    `json:"coupon,omitempty"`
		HasIssues bool           `json:"has_issues"` // any row unavailable or over-stock
	}

	AddCartItemRequest struct {
		VariantID string `json:"variant_id" validate:"required"`
		Qty       int    `json:"qty" validate:"required,gte=1,lte=99"`
	}

	UpdateCartItemRequest struct {
		Qty int `json:"qty" validate:"required,gte=1,lte=99"`
	}

	// ---- Requests ----------------------------------------------------------

	CreateCategoryRequest struct {
		Name string `json:"name" validate:"required,min=2"`
		Slug string `json:"slug"`
		Icon string `json:"icon"`
	}

	UpdateCategoryRequest struct {
		Name     string `json:"name"`
		Slug     string `json:"slug"`
		Icon     string `json:"icon"`
		IsActive *bool  `json:"is_active"`
	}

	CreateBrandRequest struct {
		Name    string `json:"name" validate:"required,min=2"`
		Slug    string `json:"slug"`
		LogoURL string `json:"logo_url"`
	}

	UpdateBrandRequest struct {
		Name     string `json:"name"`
		Slug     string `json:"slug"`
		LogoURL  string `json:"logo_url"`
		IsActive *bool  `json:"is_active"`
	}

	// CreateProductRequest creates a product together with its implicit
	// default variant (price/stock/SKU) so a freshly created product is
	// immediately sellable and visible.
	CreateProductRequest struct {
		Name          string             `json:"name" validate:"required,min=2"`
		Slug          string             `json:"slug"`
		Description   string             `json:"description"`
		CategoryID    string             `json:"category_id"`
		BrandID       string             `json:"brand_id"`
		Images        []ProductImage     `json:"images"`
		Attributes    []ProductAttribute `json:"attributes"`
		Price         int64              `json:"price" validate:"required,gt=0"`
		OriginalPrice int64              `json:"original_price"`
		Stock         int                `json:"stock"`
		SKU           string             `json:"sku"`
		Status        string             `json:"status"` // draft (default) | published
	}

	UpdateProductRequest struct {
		Name        *string            `json:"name"`
		Slug        *string            `json:"slug"`
		Description *string            `json:"description"`
		CategoryID  *string            `json:"category_id"`
		BrandID     *string            `json:"brand_id"`
		Images      []ProductImage     `json:"images"`
		Attributes  []ProductAttribute `json:"attributes"`
		IsActive    *bool              `json:"is_active"`
		Status      *string            `json:"status"`
		// Price/OriginalPrice/Stock patch the implicit default variant so the
		// basic admin form keeps working before full variant management lands.
		Price         *int64 `json:"price"`
		OriginalPrice *int64 `json:"original_price"`
		Stock         *int   `json:"stock"`
	}

	// CreateVariantRequest adds a sellable variant (size/color/…) to a
	// product. SKU is auto-generated when omitted; the display name is
	// derived from the options when omitted.
	CreateVariantRequest struct {
		Name          string          `json:"name"`
		Options       []VariantOption `json:"options"`
		SKU           string          `json:"sku"`
		Price         int64           `json:"price" validate:"required,gt=0"`
		OriginalPrice int64           `json:"original_price"`
		Stock         int             `json:"stock"`
		IsActive      *bool           `json:"is_active"`
	}

	UpdateVariantRequest struct {
		Name          *string         `json:"name"`
		Options       []VariantOption `json:"options"`
		SKU           *string         `json:"sku"`
		Price         *int64          `json:"price"`
		OriginalPrice *int64          `json:"original_price"`
		Stock         *int            `json:"stock"`
		IsActive      *bool           `json:"is_active"`
	}
)
