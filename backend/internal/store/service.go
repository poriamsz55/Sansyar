package store

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"sansyar/backend/internal/auth"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// nonAlnumRe matches everything that is not a letter (Latin or Persian), a
// digit, or a dash — used to normalise client slugs.
var nonAlnumRe = regexp.MustCompile(`[^\p{L}\p{N}-]+`)

type Service struct {
	categories    *database.Repository[Category]
	brands        *database.Repository[Brand]
	products      *database.Repository[Product]
	variants      *database.Repository[ProductVariant]
	carts         *database.Repository[Cart]
	addresses     *database.Repository[Address]
	orders        *database.Repository[Order]
	settings      *database.Repository[StoreSettings]
	users         *database.Repository[auth.User]
	orderPayments *database.Repository[OrderPayment]
	inventoryLogs *database.Repository[InventoryLog]
	coupons       *database.Repository[Coupon]
	couponUsage   *database.Repository[CouponUsage]
}

func NewService(
	categories *database.Repository[Category],
	brands *database.Repository[Brand],
	products *database.Repository[Product],
	variants *database.Repository[ProductVariant],
	carts *database.Repository[Cart],
	addresses *database.Repository[Address],
	orders *database.Repository[Order],
	settings *database.Repository[StoreSettings],
	users *database.Repository[auth.User],
	orderPayments *database.Repository[OrderPayment],
	inventoryLogs *database.Repository[InventoryLog],
	coupons *database.Repository[Coupon],
	couponUsage *database.Repository[CouponUsage],
) *Service {
	return &Service{
		categories: categories, brands: brands, products: products,
		variants: variants, carts: carts, addresses: addresses,
		orders: orders, settings: settings, users: users,
		orderPayments: orderPayments, inventoryLogs: inventoryLogs,
		coupons: coupons, couponUsage: couponUsage,
	}
}

// ---- Categories -----------------------------------------------------------

func (s *Service) ListCategories(ctx context.Context, activeOnly bool) ([]Category, error) {
	filter := bson.M{}
	if activeOnly {
		filter["is_active"] = true
	}
	return s.categories.FindAll(ctx, filter, database.Page{Limit: 200, Sort: bson.D{{Key: "name", Value: 1}}})
}

func (s *Service) CreateCategory(ctx context.Context, req CreateCategoryRequest) (Category, error) {
	now := time.Now().UTC()
	item := Category{
		ID: uuid.NewString(), Name: strings.TrimSpace(req.Name),
		Slug: NormalizeSlug(req.Slug, req.Name), Icon: req.Icon,
		IsActive: true, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.categories.Create(ctx, item); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Category{}, fmt.Errorf("%w: دسته‌بندی با این نامک قبلاً ثبت شده است", errormap.ErrConflict)
		}
		return Category{}, err
	}
	return item, nil
}

func (s *Service) UpdateCategory(ctx context.Context, id string, req UpdateCategoryRequest) (Category, error) {
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Slug != "" {
		update["slug"] = NormalizeSlug(req.Slug, req.Slug)
	}
	if req.Icon != "" {
		update["icon"] = req.Icon
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}
	if err := s.categories.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Category{}, mapRepoErr(err)
	}
	return s.categories.FindByID(ctx, id)
}

func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	// Categories referenced by products are never hard-deleted; the dangling
	// reference would silently break storefront filtering.
	count, err := s.products.Count(ctx, bson.M{"category_id": id})
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("%w: این دسته‌بندی به %d محصول متصل است و قابل حذف نیست", errormap.ErrConflict, count)
	}
	if err := s.categories.Delete(ctx, id); err != nil {
		return mapRepoErr(err)
	}
	return nil
}

// ---- Brands ---------------------------------------------------------------

func (s *Service) ListBrands(ctx context.Context, activeOnly bool) ([]Brand, error) {
	filter := bson.M{}
	if activeOnly {
		filter["is_active"] = true
	}
	return s.brands.FindAll(ctx, filter, database.Page{Limit: 200, Sort: bson.D{{Key: "name", Value: 1}}})
}

func (s *Service) CreateBrand(ctx context.Context, req CreateBrandRequest) (Brand, error) {
	now := time.Now().UTC()
	item := Brand{
		ID: uuid.NewString(), Name: strings.TrimSpace(req.Name),
		Slug: NormalizeSlug(req.Slug, req.Name), LogoURL: req.LogoURL,
		IsActive: true, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.brands.Create(ctx, item); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Brand{}, fmt.Errorf("%w: برند با این نامک قبلاً ثبت شده است", errormap.ErrConflict)
		}
		return Brand{}, err
	}
	return item, nil
}

func (s *Service) UpdateBrand(ctx context.Context, id string, req UpdateBrandRequest) (Brand, error) {
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Slug != "" {
		update["slug"] = NormalizeSlug(req.Slug, req.Slug)
	}
	if req.LogoURL != "" {
		update["logo_url"] = req.LogoURL
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}
	if err := s.brands.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Brand{}, mapRepoErr(err)
	}
	return s.brands.FindByID(ctx, id)
}

func (s *Service) DeleteBrand(ctx context.Context, id string) error {
	count, err := s.products.Count(ctx, bson.M{"brand_id": id})
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("%w: این برند به %d محصول متصل است و قابل حذف نیست", errormap.ErrConflict, count)
	}
	if err := s.brands.Delete(ctx, id); err != nil {
		return mapRepoErr(err)
	}
	return nil
}

// ---- Products: read models -------------------------------------------------

// ProductFilter is the shared query shape for storefront and admin listing.
type ProductFilter struct {
	Q          string
	CategoryID string
	BrandID    string
	Status     string
	PublicOnly bool
	MinPrice   int64
	MaxPrice   int64
	// Availability: "" (all), "in_stock", "out_of_stock".
	Availability string
	// Sort: "" | "newest" | "price_asc" | "price_desc" | "discount" | "name".
	Sort  string
	Page  int
	Limit int
}

func (s *Service) ListProductsPublic(ctx context.Context, f ProductFilter) (PaginatedProducts, error) {
	f.PublicOnly = true
	return s.listProducts(ctx, f)
}

func (s *Service) ListProductsAdmin(ctx context.Context, f ProductFilter) (PaginatedProducts, error) {
	return s.listProducts(ctx, f)
}

// productAggRow decodes one row of the catalog aggregation: the product
// document plus variant-derived pricing/stock fields.
type productAggRow struct {
	Product        `bson:",inline"`
	PriceFrom      int64  `bson:"price_from"`
	OriginalFrom   int64  `bson:"original_from"`
	DiscountMax    int    `bson:"discount_max"`
	TotalStock     int    `bson:"total_stock"`
	VariantCount   int    `bson:"variant_count"`
	AvailableStock int    `bson:"available_stock"`
	PrimaryImage   string `bson:"primary_image"`
}

// listProducts serves both storefront and admin listings through one
// aggregation that joins each product with its active variants. Price and
// availability filters and price/discount sorting therefore operate on live
// variant data (computed before pagination, so totals stay correct).
func (s *Service) listProducts(ctx context.Context, f ProductFilter) (PaginatedProducts, error) {
	match := bson.M{}
	if f.PublicOnly {
		match["status"] = ProductPublished
		match["is_active"] = true
	} else if f.Status != "" {
		match["status"] = f.Status
	}
	if f.CategoryID != "" {
		match["category_id"] = f.CategoryID
	}
	if f.BrandID != "" {
		match["brand_id"] = f.BrandID
	}
	if q := strings.TrimSpace(f.Q); q != "" {
		match["name"] = bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}
	}

	page, limit := normalizePage(f.Page, f.Limit)

	// Variant-derived expressions shared by the $addFields stage.
	discountOfVariant := bson.M{"$floor": bson.M{"$multiply": bson.A{
		100,
		bson.M{"$divide": bson.A{
			bson.M{"$subtract": bson.A{"$$this.original_price", "$$this.price"}},
			"$$this.original_price",
		}},
	}}}
	hasDiscount := bson.M{"$and": bson.A{
		bson.M{"$gt": bson.A{"$$this.original_price", 0}},
		bson.M{"$gt": bson.A{"$$this.original_price", "$$this.price"}},
		bson.M{"$gt": bson.A{"$$this.price", 0}},
	}}
	withOriginal := bson.M{"$filter": bson.M{
		"input": "$variants",
		"cond":  bson.M{"$gt": bson.A{"$$this.original_price", 0}},
	}}
	productImages := bson.M{"$ifNull": bson.A{"$images", bson.A{}}}
	primaryFlagged := bson.M{"$filter": bson.M{
		"input": "$$imgs",
		"cond":  bson.M{"$eq": bson.A{"$$this.is_primary", true}},
	}}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: match}},
		{{Key: "$lookup", Value: bson.M{
			"from":         "store_product_variants",
			"localField":   "_id",
			"foreignField": "product_id",
			"as":           "variants",
			// Only active variants drive pricing/stock (mirrors summarize()).
			"pipeline": mongo.Pipeline{{{Key: "$match", Value: bson.M{"is_active": true}}}},
		}}},
		{{Key: "$addFields", Value: bson.M{
			"price_from": bson.M{"$min": "$variants.price"},
			"original_from": bson.M{"$ifNull": bson.A{
				bson.M{"$min": bson.M{"$map": bson.M{"input": withOriginal, "in": "$$this.original_price"}}},
				0,
			}},
			"discount_max": bson.M{"$max": bson.M{"$map": bson.M{
				"input": "$variants",
				"in":    bson.M{"$cond": bson.A{hasDiscount, discountOfVariant, 0}},
			}}},
			"total_stock":   bson.M{"$sum": "$variants.stock"},
			"variant_count": bson.M{"$size": bson.M{"$ifNull": bson.A{"$variants", bson.A{}}}},
			"available_stock": bson.M{"$sum": bson.M{"$map": bson.M{
				"input": "$variants",
				"in":    bson.M{"$subtract": bson.A{"$$this.stock", "$$this.reserved"}},
			}}},
			"primary_image": bson.M{"$let": bson.M{
				"vars": bson.M{"imgs": productImages},
				"in": bson.M{"$let": bson.M{
					"vars": bson.M{"prim": primaryFlagged},
					"in": bson.M{"$cond": bson.A{
						bson.M{"$gt": bson.A{bson.M{"$size": "$$prim"}, 0}},
						bson.M{"$arrayElemAt": bson.A{"$$prim.url", 0}},
						bson.M{"$cond": bson.A{
							bson.M{"$gt": bson.A{bson.M{"$size": "$$imgs"}, 0}},
							bson.M{"$arrayElemAt": bson.A{"$$imgs.url", 0}},
							"",
						}},
					}},
				}},
			}},
		}}},
	}

	// Price range and availability operate on the derived fields.
	derived := bson.M{}
	if f.MinPrice > 0 || f.MaxPrice > 0 {
		cond := bson.M{}
		if f.MinPrice > 0 {
			cond["$gte"] = f.MinPrice
		}
		if f.MaxPrice > 0 {
			cond["$lte"] = f.MaxPrice
		}
		derived["price_from"] = cond
	}
	switch f.Availability {
	case "in_stock":
		derived["available_stock"] = bson.M{"$gt": 0}
	case "out_of_stock":
		derived["available_stock"] = bson.M{"$lte": 0}
	}
	if len(derived) > 0 {
		pipeline = append(pipeline, bson.D{{Key: "$match", Value: derived}})
	}

	sort := bson.D{}
	switch f.Sort {
	case "price_asc":
		sort = bson.D{{Key: "price_from", Value: 1}, {Key: "created_at", Value: -1}}
	case "price_desc":
		sort = bson.D{{Key: "price_from", Value: -1}, {Key: "created_at", Value: -1}}
	case "discount":
		sort = bson.D{{Key: "discount_max", Value: -1}, {Key: "created_at", Value: -1}}
	case "name":
		sort = bson.D{{Key: "name", Value: 1}}
	default: // newest first
		sort = bson.D{{Key: "created_at", Value: -1}}
	}
	pipeline = append(pipeline, bson.D{{Key: "$sort", Value: sort}})

	pipeline = append(pipeline, bson.D{{Key: "$facet", Value: bson.M{
		"page_items": bson.A{
			bson.M{"$skip": (page - 1) * limit},
			bson.M{"$limit": limit},
		},
		"total_count": bson.A{bson.M{"$count": "count"}},
	}}})

	cursor, err := s.products.Collection().Aggregate(ctx, pipeline)
	if err != nil {
		return PaginatedProducts{}, err
	}
	defer cursor.Close(ctx)

	var rows []struct {
		PageItems  []productAggRow `bson:"page_items"`
		TotalCount []struct {
			Count int64 `bson:"count"`
		} `bson:"total_count"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return PaginatedProducts{}, err
	}
	if len(rows) == 0 {
		return PaginatedProducts{Items: []ProductListItem{}, Page: page, Limit: limit}, nil
	}

	row := rows[0]
	items := make([]ProductListItem, 0, len(row.PageItems))
	for _, r := range row.PageItems {
		items = append(items, ProductListItem{
			Product: r.Product,
			VariantSummary: VariantSummary{
				PriceFrom:      r.PriceFrom,
				OriginalFrom:   r.OriginalFrom,
				DiscountMax:    r.DiscountMax,
				TotalStock:     r.TotalStock,
				AvailableStock: r.AvailableStock,
				VariantCount:   r.VariantCount,
			},
			PrimaryImage: r.PrimaryImage,
		})
	}
	total := int64(0)
	if len(row.TotalCount) > 0 {
		total = row.TotalCount[0].Count
	}
	return PaginatedProducts{Items: items, Total: total, Page: page, Limit: limit}, nil
}

// GetProductPublic resolves a storefront product by id or slug. Unpublished
// products are hidden from shoppers.
func (s *Service) GetProductPublic(ctx context.Context, idOrSlug string) (ProductDetail, error) {
	detail, err := s.getProduct(ctx, idOrSlug, false)
	if err != nil {
		return ProductDetail{}, err
	}
	if detail.Status != ProductPublished || !detail.IsActive {
		return ProductDetail{}, errormap.ErrNotFound
	}
	return detail, nil
}

func (s *Service) GetProductAdmin(ctx context.Context, idOrSlug string) (ProductDetail, error) {
	return s.getProduct(ctx, idOrSlug, true)
}

func (s *Service) getProduct(ctx context.Context, idOrSlug string, includeInactiveVariants bool) (ProductDetail, error) {
	product, err := s.products.FindByID(ctx, idOrSlug)
	if errors.Is(err, database.ErrNotFound) {
		product, err = s.products.FindOne(ctx, bson.M{"slug": idOrSlug})
		if err != nil {
			return ProductDetail{}, errormap.ErrNotFound
		}
	} else if err != nil {
		return ProductDetail{}, err
	}

	vfilter := bson.M{"product_id": product.ID}
	if !includeInactiveVariants {
		vfilter["is_active"] = true
	}
	variants, err := s.variants.FindAll(ctx, vfilter, database.Page{Limit: 200, Sort: bson.D{{Key: "created_at", Value: 1}}})
	if err != nil {
		return ProductDetail{}, err
	}

	detail := ProductDetail{
		Product:        product,
		VariantSummary: summarize(variants),
		Variants:       variants,
	}
	if product.CategoryID != "" {
		if category, err := s.categories.FindByID(ctx, product.CategoryID); err == nil {
			detail.Category = &category
		}
	}
	if product.BrandID != "" {
		if brand, err := s.brands.FindByID(ctx, product.BrandID); err == nil {
			detail.Brand = &brand
		}
	}
	return detail, nil
}

// attachSummaries was replaced by the catalog aggregation in listProducts.

// ---- Variants ---------------------------------------------------------------

// CreateVariant adds a sellable variant to a product.
func (s *Service) CreateVariant(ctx context.Context, productID string, req CreateVariantRequest) (ProductDetail, error) {
	if _, err := s.products.FindByID(ctx, productID); err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}
	now := time.Now().UTC()
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	variant := ProductVariant{
		ID: uuid.NewString(), ProductID: productID,
		Name:    variantDisplayName(req.Name, req.Options),
		Options: normalizeOptions(req.Options),
		SKU:     defaultSKU(req.SKU), Price: req.Price, OriginalPrice: req.OriginalPrice,
		Stock: req.Stock, IsActive: active, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.variants.Create(ctx, variant); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ProductDetail{}, fmt.Errorf("%w: این کد کالا (SKU) قبلاً ثبت شده است", errormap.ErrConflict)
		}
		return ProductDetail{}, err
	}
	return s.GetProductAdmin(ctx, productID)
}

func (s *Service) UpdateVariant(ctx context.Context, id string, req UpdateVariantRequest) (ProductDetail, error) {
	variant, err := s.variants.FindByID(ctx, id)
	if err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != nil {
		update["name"] = variantDisplayName(*req.Name, req.Options)
	}
	if req.Options != nil {
		update["options"] = normalizeOptions(req.Options)
	}
	if req.SKU != nil && strings.TrimSpace(*req.SKU) != "" {
		update["sku"] = strings.ToUpper(strings.TrimSpace(*req.SKU))
	}
	if req.Price != nil {
		update["price"] = *req.Price
	}
	if req.OriginalPrice != nil {
		update["original_price"] = *req.OriginalPrice
	}
	if req.Stock != nil {
		update["stock"] = *req.Stock
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}
	if err := s.variants.Update(ctx, id, bson.M{"$set": update}); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ProductDetail{}, fmt.Errorf("%w: این کد کالا (SKU) قبلاً ثبت شده است", errormap.ErrConflict)
		}
		return ProductDetail{}, mapRepoErr(err)
	}
	return s.GetProductAdmin(ctx, variant.ProductID)
}

// DeleteVariant removes one variant. A product must keep at least one
// sellable variant, so the last one cannot be deleted.
func (s *Service) DeleteVariant(ctx context.Context, id string) (ProductDetail, error) {
	variant, err := s.variants.FindByID(ctx, id)
	if err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}
	count, err := s.variants.Count(ctx, bson.M{"product_id": variant.ProductID})
	if err != nil {
		return ProductDetail{}, err
	}
	if count <= 1 {
		return ProductDetail{}, fmt.Errorf("%w: هر محصول باید حداقل یک گونه فعال داشته باشد", errormap.ErrConflict)
	}
	if err := s.variants.Delete(ctx, id); err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}
	return s.GetProductAdmin(ctx, variant.ProductID)
}

// variantDisplayName prefers an explicit name, else derives it from the
// options (e.g. "سایز ۴۲ / رنگ سرخ"), else "default".
func variantDisplayName(name string, options []VariantOption) string {
	if trimmed := strings.TrimSpace(name); trimmed != "" {
		return trimmed
	}
	parts := make([]string, 0, len(options))
	for _, o := range options {
		if o.Key != "" && o.Value != "" {
			parts = append(parts, fmt.Sprintf("%s %s", o.Key, o.Value))
		}
	}
	if len(parts) > 0 {
		return strings.Join(parts, " / ")
	}
	return VariantDefaultName
}

func normalizeOptions(options []VariantOption) []VariantOption {
	out := make([]VariantOption, 0, len(options))
	for _, o := range options {
		key := strings.TrimSpace(o.Key)
		value := strings.TrimSpace(o.Value)
		if key == "" || value == "" {
			continue
		}
		out = append(out, VariantOption{Key: key, Value: value})
	}
	return out
}

// ---- Products: writes ------------------------------------------------------

func (s *Service) CreateProduct(ctx context.Context, req CreateProductRequest) (ProductDetail, error) {
	if req.CategoryID != "" {
		if _, err := s.categories.FindByID(ctx, req.CategoryID); err != nil {
			return ProductDetail{}, errormap.ErrNotFound
		}
	}
	if req.BrandID != "" {
		if _, err := s.brands.FindByID(ctx, req.BrandID); err != nil {
			return ProductDetail{}, errormap.ErrNotFound
		}
	}

	now := time.Now().UTC()
	status := ProductDraft
	if req.Status == ProductPublished {
		status = ProductPublished
	}
	product := Product{
		ID: uuid.NewString(), Name: strings.TrimSpace(req.Name),
		Slug:        s.uniqueSlug(ctx, NormalizeSlug(req.Slug, req.Name), ""),
		Description: req.Description,
		CategoryID:  req.CategoryID, BrandID: req.BrandID,
		Images: normalizeImages(req.Images), Attributes: req.Attributes,
		Status: status, IsActive: true, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.products.Create(ctx, product); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return ProductDetail{}, fmt.Errorf("%w: محصول با این نامک قبلاً ثبت شده است", errormap.ErrConflict)
		}
		return ProductDetail{}, err
	}

	variant := ProductVariant{
		ID: uuid.NewString(), ProductID: product.ID, Name: VariantDefaultName,
		SKU: defaultSKU(req.SKU), Price: req.Price, OriginalPrice: req.OriginalPrice,
		Stock: req.Stock, IsActive: true, CreatedAt: now, UpdatedAt: now,
	}
	if err := s.variants.Create(ctx, variant); err != nil {
		// Without a variant the product is unsellable; drop it again.
		_ = s.products.Delete(ctx, product.ID)
		return ProductDetail{}, err
	}
	return s.GetProductAdmin(ctx, product.ID)
}

func (s *Service) UpdateProduct(ctx context.Context, id string, req UpdateProductRequest) (ProductDetail, error) {
	product, err := s.products.FindByID(ctx, id)
	if err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}
	if req.CategoryID != nil {
		if *req.CategoryID != "" {
			if _, err := s.categories.FindByID(ctx, *req.CategoryID); err != nil {
				return ProductDetail{}, errormap.ErrNotFound
			}
		}
		product.CategoryID = *req.CategoryID
	}
	if req.BrandID != nil {
		if *req.BrandID != "" {
			if _, err := s.brands.FindByID(ctx, *req.BrandID); err != nil {
				return ProductDetail{}, errormap.ErrNotFound
			}
		}
		product.BrandID = *req.BrandID
	}
	if req.Name != nil && *req.Name != "" {
		product.Name = *req.Name
	}
	if req.Slug != nil && *req.Slug != "" {
		product.Slug = s.uniqueSlug(ctx, NormalizeSlug(*req.Slug, *req.Slug), product.ID)
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.Images != nil {
		product.Images = normalizeImages(req.Images)
	}
	if req.Attributes != nil {
		product.Attributes = req.Attributes
	}
	if req.IsActive != nil {
		product.IsActive = *req.IsActive
	}
	if req.Status != nil && (*req.Status == ProductDraft || *req.Status == ProductPublished) {
		product.Status = *req.Status
	}
	product.UpdatedAt = time.Now().UTC()

	update, err := bsonToSet(product)
	if err != nil {
		return ProductDetail{}, err
	}
	if err := s.products.Update(ctx, id, update); err != nil {
		return ProductDetail{}, mapRepoErr(err)
	}

	// Price/original price/stock patch the implicit default variant so the
	// basic admin form keeps working before full variant management lands.
	if req.Price != nil || req.OriginalPrice != nil || req.Stock != nil {
		def, err := s.variants.FindOne(ctx, bson.M{"product_id": id, "name": VariantDefaultName})
		if err == nil {
			vUpdate := bson.M{"updated_at": time.Now().UTC()}
			if req.Price != nil {
				vUpdate["price"] = *req.Price
			}
			if req.OriginalPrice != nil {
				vUpdate["original_price"] = *req.OriginalPrice
			}
			if req.Stock != nil {
				vUpdate["stock"] = *req.Stock
			}
			if err := s.variants.Update(ctx, def.ID, bson.M{"$set": vUpdate}); err != nil {
				return ProductDetail{}, mapRepoErr(err)
			}
		}
	}
	return s.GetProductAdmin(ctx, id)
}

func (s *Service) SetProductStatus(ctx context.Context, id string, published bool) (Product, error) {
	status := ProductDraft
	if published {
		status = ProductPublished
	}
	if err := s.products.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); err != nil {
		return Product{}, mapRepoErr(err)
	}
	return s.products.FindByID(ctx, id)
}

func (s *Service) DeleteProduct(ctx context.Context, id string) error {
	product, err := s.products.FindByID(ctx, id)
	if err != nil {
		return mapRepoErr(err)
	}
	// Remove the product's variants with it; future orders keep their own
	// price/name snapshots, so history stays correct.
	if _, err := s.variants.Collection().DeleteMany(ctx, bson.M{"product_id": product.ID}); err != nil {
		return err
	}
	if err := s.products.Delete(ctx, id); err != nil {
		return mapRepoErr(err)
	}
	return nil
}

// ---- helpers ---------------------------------------------------------------

// NormalizeSlug turns free text into a URL-safe slug. Persian input is kept
// as-is (URL-encoded by clients); everything else is stripped.
func NormalizeSlug(raw string, fallback string) string {
	base := strings.TrimSpace(raw)
	if base == "" {
		base = strings.TrimSpace(fallback)
	}
	base = strings.ToLower(base)
	base = nonAlnumRe.ReplaceAllString(base, "-")
	for strings.Contains(base, "--") {
		base = strings.ReplaceAll(base, "--", "-")
	}
	return strings.Trim(base, "-")
}

// uniqueSlug appends a short random suffix while the slug is taken by another
// product (exceptID excludes the product currently being renamed).
func (s *Service) uniqueSlug(ctx context.Context, slug string, exceptID string) string {
	if slug == "" {
		slug = "p-" + uuid.NewString()[:8]
	}
	candidate := slug
	for attempt := 0; attempt < 4; attempt++ {
		filter := bson.M{"slug": candidate}
		if exceptID != "" {
			filter["_id"] = bson.M{"$ne": exceptID}
		}
		if _, err := s.products.FindOne(ctx, filter); errors.Is(err, database.ErrNotFound) {
			return candidate
		}
		candidate = fmt.Sprintf("%s-%s", slug, randSuffix())
	}
	return candidate + "-" + uuid.NewString()[:8]
}

func randSuffix() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 4)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b)
}

func defaultSKU(clientSKU string) string {
	sku := strings.ToUpper(strings.TrimSpace(clientSKU))
	if sku == "" {
		sku = "SKU-" + strings.ToUpper(uuid.NewString()[:8])
	}
	return sku
}

// normalizeImages guarantees at most one primary image and a non-nil slice.
func normalizeImages(images []ProductImage) []ProductImage {
	if len(images) == 0 {
		return []ProductImage{}
	}
	seen := false
	for i := range images {
		images[i].URL = strings.TrimSpace(images[i].URL)
		if images[i].IsPrimary && !seen {
			seen = true
		} else {
			images[i].IsPrimary = false
		}
	}
	if !seen {
		images[0].IsPrimary = true
	}
	return images
}

func primaryImage(images []ProductImage) string {
	for _, img := range images {
		if img.IsPrimary {
			return img.URL
		}
	}
	if len(images) > 0 {
		return images[0].URL
	}
	return ""
}

// summarize computes price/stock aggregates over a product's active variants.
func summarize(variants []ProductVariant) VariantSummary {
	var sum VariantSummary
	firstPrice, firstOriginal := true, true
	for _, v := range variants {
		if firstPrice || v.Price < sum.PriceFrom {
			sum.PriceFrom = v.Price
			firstPrice = false
		}
		if v.OriginalPrice > 0 {
			if firstOriginal || v.OriginalPrice < sum.OriginalFrom {
				sum.OriginalFrom = v.OriginalPrice
				firstOriginal = false
			}
		}
		if d := discountPercent(v.Price, v.OriginalPrice); d > sum.DiscountMax {
			sum.DiscountMax = d
		}
		sum.TotalStock += v.Stock
		sum.AvailableStock += v.Stock - v.Reserved
	}
	sum.VariantCount = len(variants)
	return sum
}

func discountPercent(price int64, original int64) int {
	if original <= 0 || original <= price || price <= 0 {
		return 0
	}
	return int(float64(original-price) * 100 / float64(original))
}

func normalizePage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 12
	}
	return page, limit
}

// bsonToSet marshals a document struct into a {$set: …} update payload,
// dropping the immutable _id key.
func bsonToSet(doc any) (bson.M, error) {
	raw, err := bson.Marshal(doc)
	if err != nil {
		return nil, err
	}
	var m bson.M
	if err := bson.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	delete(m, "_id")
	return bson.M{"$set": m}, nil
}

func mapRepoErr(err error) error {
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	}
	return err
}
