package store

import (
	"context"
	"os"
	"testing"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"sansyar/backend/pkg/database"
)

// Integration helper against a local MongoDB (used during development to
// debug the catalog aggregation). Skipped unless STORE_MONGO_TEST=1.
func TestListProductsIntegration(t *testing.T) {
	if os.Getenv("STORE_MONGO_TEST") != "1" {
		t.Skip("set STORE_MONGO_TEST=1 to run against local mongo")
	}
	ctx := context.Background()
	client, err := mongo.Connect(options.Client().ApplyURI("mongodb://localhost:27017"))
	if err != nil {
		t.Fatal(err)
	}
	defer client.Disconnect(ctx)
	db := client.Database("sansyar")

	svc := NewService(
		database.NewRepository[Category](db.Collection("store_categories")),
		database.NewRepository[Brand](db.Collection("store_brands")),
		database.NewRepository[Product](db.Collection("store_products")),
		database.NewRepository[ProductVariant](db.Collection("store_product_variants")),
		database.NewRepository[Cart](db.Collection("store_carts")),
		database.NewRepository[Address](db.Collection("store_addresses")),
		database.NewRepository[Order](db.Collection("store_orders")),
		database.NewRepository[StoreSettings](db.Collection("store_settings")),
		nil,
		database.NewRepository[OrderPayment](db.Collection("store_order_payments")),
		database.NewRepository[InventoryLog](db.Collection("store_inventory_logs")),
		database.NewRepository[Coupon](db.Collection("store_coupons")),
		database.NewRepository[CouponUsage](db.Collection("store_coupon_usage")),
	)

	for _, f := range []ProductFilter{
		{PublicOnly: true},
		{PublicOnly: true, Sort: "price_asc"},
		{PublicOnly: true, MinPrice: 500000, MaxPrice: 1000000},
		{PublicOnly: true, Availability: "out_of_stock"},
		{PublicOnly: true, Sort: "discount"},
	} {
		res, err := svc.ListProductsPublic(ctx, f)
		if err != nil {
			t.Fatalf("filter %+v: %v", f, err)
		}
		t.Logf("filter %+v -> total=%d first=%v", f, res.Total, func() string {
			if len(res.Items) == 0 {
				return "-"
			}
			return res.Items[0].Name
		}())
	}
}
