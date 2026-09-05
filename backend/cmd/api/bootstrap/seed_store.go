package bootstrap

import (
	"context"
	"time"

	"sansyar/backend/internal/store"
	"sansyar/backend/pkg/database"
)

// seedStoreData fills the store with a small, realistic demo catalog when
// SEED_DATA is enabled. Products deliberately have no images — the seeded
// storefront shows the image placeholder until an admin uploads real photos
// through the Store Admin (no fake URLs that 404).
func seedStoreData(
	ctx context.Context,
	categories *database.Repository[store.Category],
	brands *database.Repository[store.Brand],
	products *database.Repository[store.Product],
	variants *database.Repository[store.ProductVariant],
) error {
	if count, err := categories.Count(ctx, map[string]any{}); err != nil {
		return err
	} else if count > 0 {
		return nil
	}

	now := time.Now().UTC()

	cats := []store.Category{
		{ID: "store-cat-balls", Name: "توپ ورزشی", Slug: "balls", Icon: "circle", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: "store-cat-rackets", Name: "راکت و بت", Slug: "rackets", Icon: "zap", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: "store-cat-apparel", Name: "پوشاک ورزشی", Slug: "apparel", Icon: "shirt", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: "store-cat-gear", Name: "تجهیزات و لوازم", Slug: "gear", Icon: "duffle", IsActive: true, CreatedAt: now, UpdatedAt: now},
	}
	for _, c := range cats {
		if err := categories.Create(ctx, c); err != nil {
			return err
		}
	}

	brandList := []store.Brand{
		{ID: "store-brand-aria", Name: "آریا اسپرت", Slug: "aria-sport", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: "store-brand-promax", Name: "پرومکس", Slug: "promax", IsActive: true, CreatedAt: now, UpdatedAt: now},
		{ID: "store-brand-fitlife", Name: "فیت‌لایف", Slug: "fitlife", IsActive: true, CreatedAt: now, UpdatedAt: now},
	}
	for _, b := range brandList {
		if err := brands.Create(ctx, b); err != nil {
			return err
		}
	}

	type seedProduct struct {
		id, name, slug, cat, brand, desc string
		price, original                  int64
		stock                            int
		attrs                            []store.ProductAttribute
		published                        bool
	}
	list := []seedProduct{
		{id: "store-p-ball-football", name: "توپ فوتبال حرفه‌ای سایز ۵", slug: "pro-football-size-5", cat: "store-cat-balls", brand: "store-brand-aria",
			desc:  "توپ فوتبال دوخت ماشینی با پوشش مقاوم، مناسب چمن طبیعی و مصنوعی. دارای استاندارد سایز ۵ فیفا.",
			price: 1_200_000, original: 1_500_000, stock: 24,
			attrs:     []store.ProductAttribute{{Key: "جنس", Value: "PU چرم مصنوعی"}, {Key: "سایز", Value: "۵"}},
			published: true},
		{id: "store-p-ball-volley", name: "توپ والیبال نرم پیک", slug: "soft-volleyball", cat: "store-cat-balls", brand: "store-brand-promax",
			desc:  "توپ والیبال با کیفیت نرم و وزن استاندارد، مناسب تمرین و مسابقات سالنی.",
			price: 850_000, stock: 30, published: true},
		{id: "store-p-racket-tennis", name: "راکت تنیس حرفه‌ای کربنی", slug: "carbon-tennis-racket", cat: "store-cat-rackets", brand: "store-brand-promax",
			desc:  "راکت تنیس فریم کربنی سبک با تعادل مناسب برای بازیکنان میانی تا پیشرفته؛ همراه با کیف راکت.",
			price: 4_800_000, original: 5_500_000, stock: 8,
			attrs:     []store.ProductAttribute{{Key: "وزن", Value: "۳۰۰ گرم"}, {Key: "اندازه دسته", Value: "۲"}},
			published: true},
		{id: "store-p-shoes-futsal", name: "کفش فوتسال چمن مصنوعی", slug: "futsal-shoes-turf", cat: "store-cat-apparel", brand: "store-brand-fitlife",
			desc:  "کفش فوتسال با کف مقاوم و رویه تنفسی، مناسب چمن مصنوعی و سالن.",
			price: 3_200_000, stock: 15, published: true},
		{id: "store-p-shorts", name: "شلوارک ورزشی رانینگ", slug: "running-shorts", cat: "store-cat-apparel", brand: "store-brand-fitlife",
			desc:  "شلوارک ورزشی سبک و خنک با جیب زیپی، مناسب دویدن و تمرین بدنسازی.",
			price: 650_000, stock: 40, published: true},
		{id: "store-p-gloves-box", name: "دستکش بوکس ۱۲ اونس", slug: "boxing-gloves-12oz", cat: "store-cat-gear", brand: "store-brand-aria",
			desc:  "دستکش بوکس با رویه چرم مصنوعی و فوم ضربه‌گیر؛ بند چسبی مچ برای ثبات بیشتر.",
			price: 1_450_000, stock: 12,
			attrs:     []store.ProductAttribute{{Key: "وزن", Value: "۱۲ اونس"}},
			published: true},
		{id: "store-p-bag-duffle", name: "ساک ورزشی ۴۵ لیتری", slug: "duffle-bag-45l", cat: "store-cat-gear", brand: "store-brand-aria",
			desc:  "ساک ورزشی جادار با محفظه جدا برای کفش و لباس خیس.",
			price: 1_100_000, stock: 18, published: true},
		{id: "store-p-ball-basket", name: "توپ بسکتبال سالنی سایز ۷", slug: "indoor-basketball-7", cat: "store-cat-balls", brand: "store-brand-promax",
			desc:  "توپ بسکتبال سالنی با پوشش چرمی و چسبندگی بالا (پیش‌نمایش — هنوز منتشر نشده).",
			price: 1_350_000, stock: 10, published: false},
	}

	for _, p := range list {
		status := store.ProductDraft
		if p.published {
			status = store.ProductPublished
		}
		item := store.Product{
			ID: p.id, Name: p.name, Slug: p.slug, Description: p.desc,
			CategoryID: p.cat, BrandID: p.brand,
			Images: []store.ProductImage{}, Attributes: p.attrs,
			Status: status, IsActive: true, CreatedAt: now, UpdatedAt: now,
		}
		if err := products.Create(ctx, item); err != nil {
			return err
		}
		variant := store.ProductVariant{
			ID: p.id + "-v1", ProductID: p.id, Name: store.VariantDefaultName,
			SKU: "SKU-" + p.slug + "-01", Price: p.price, OriginalPrice: p.original,
			Stock: p.stock, IsActive: true, CreatedAt: now, UpdatedAt: now,
		}
		if err := variants.Create(ctx, variant); err != nil {
			return err
		}
	}
	return nil
}
