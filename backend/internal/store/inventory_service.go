package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

// logInventory appends one audit row (never blocks the main flow on failure
// of the log write alone — the stock change itself already succeeded).
func (s *Service) logInventory(ctx context.Context, orderID string, by string, reason string, item OrderItem, delta int, reservedDelta int) {
	entry := InventoryLog{
		ID: uuid.NewString(), VariantID: item.VariantID, ProductID: item.ProductID,
		SKU: item.SKU, Delta: delta, Reserved: reservedDelta,
		Reason: reason, OrderID: orderID, By: by, At: time.Now().UTC(),
	}
	_ = s.inventoryLogs.Create(ctx, entry)
}

// reserveStock atomically reserves each order item against
// `stock - reserved`. If any item cannot be reserved, previously reserved
// items are rolled back and the caller receives a conflict.
func (s *Service) reserveStock(ctx context.Context, order Order) error {
	reserved := make([]OrderItem, 0, len(order.Items))
	for _, item := range order.Items {
		result, err := s.variants.Collection().UpdateOne(ctx,
			bson.M{"_id": item.VariantID, "$expr": bson.M{"$gte": bson.A{
				bson.M{"$subtract": bson.A{"$stock", "$reserved"}},
				item.Qty,
			}}},
			bson.M{"$inc": bson.M{"reserved": item.Qty}, "$set": bson.M{"updated_at": time.Now().UTC()}},
		)
		if err != nil {
			s.releaseReserved(ctx, order.ID, reserved)
			return err
		}
		if result.MatchedCount == 0 {
			s.releaseReserved(ctx, order.ID, reserved)
			variant, verr := s.variants.FindByID(ctx, item.VariantID)
			available := 0
			if verr == nil {
				available = variant.Stock - variant.Reserved
			}
			s.releaseReserved(ctx, order.ID, []OrderItem{item}) // no-op (not yet reserved)
			return fmt.Errorf("%w: موجودی «%s» کافی نیست (موجود: %d)", errormap.ErrConflict, item.ProductName, max(available, 0))
		}
		reserved = append(reserved, item)
		s.logInventory(ctx, order.ID, order.UserID, "reserve", item, 0, item.Qty)
	}
	return nil
}

// releaseReserved rolls back reservations (best-effort).
func (s *Service) releaseReserved(ctx context.Context, orderID string, items []OrderItem) {
	for _, item := range items {
		_, _ = s.variants.Collection().UpdateOne(ctx,
			bson.M{"_id": item.VariantID},
			bson.M{"$inc": bson.M{"reserved": -item.Qty}},
		)
		s.logInventory(ctx, orderID, "system", "reserve_rollback", item, 0, -item.Qty)
	}
}

// commitStock converts reservations into sales after payment verification:
// reserved -= qty AND stock -= qty.
func (s *Service) commitStock(ctx context.Context, order Order) {
	for _, item := range order.Items {
		_, _ = s.variants.Collection().UpdateOne(ctx,
			bson.M{"_id": item.VariantID},
			bson.M{"$inc": bson.M{"reserved": -item.Qty, "stock": -item.Qty}, "$set": bson.M{"updated_at": time.Now().UTC()}},
		)
		s.logInventory(ctx, order.ID, order.UserID, "sale", item, -item.Qty, -item.Qty)
	}
}

// releaseStock returns pending reservations (cancel before payment).
func (s *Service) releaseStock(ctx context.Context, order Order, by string) {
	for _, item := range order.Items {
		_, _ = s.variants.Collection().UpdateOne(ctx,
			bson.M{"_id": item.VariantID},
			bson.M{"$inc": bson.M{"reserved": -item.Qty}, "$set": bson.M{"updated_at": time.Now().UTC()}},
		)
		s.logInventory(ctx, order.ID, by, "release", item, 0, -item.Qty)
	}
}

// restockStock returns sold items to stock (cancel after payment).
func (s *Service) restockStock(ctx context.Context, order Order, by string) {
	for _, item := range order.Items {
		_, _ = s.variants.Collection().UpdateOne(ctx,
			bson.M{"_id": item.VariantID},
			bson.M{"$inc": bson.M{"stock": item.Qty}, "$set": bson.M{"updated_at": time.Now().UTC()}},
		)
		s.logInventory(ctx, order.ID, by, "restock", item, item.Qty, 0)
	}
}

// ---- Admin: adjustments & logs ----------------------------------------------

// AdjustStock applies a manual delta to a variant's stock with an audit log.
func (s *Service) AdjustStock(ctx context.Context, variantID string, delta int, reason string, by string) (ProductVariant, InventoryLog, error) {
	variant, err := s.variants.FindByID(ctx, variantID)
	if err != nil {
		return ProductVariant{}, InventoryLog{}, mapRepoErr(err)
	}
	if variant.Stock+delta < 0 {
		return ProductVariant{}, InventoryLog{}, fmt.Errorf("%w: موجودی نمی‌تواند منفی شود (فعلی: %d، درخواست: %+d)", errormap.ErrConflict, variant.Stock, delta)
	}
	if err := s.variants.Update(ctx, variantID, bson.M{
		"$inc": bson.M{"stock": delta}, "$set": bson.M{"updated_at": time.Now().UTC()},
	}); err != nil {
		return ProductVariant{}, InventoryLog{}, mapRepoErr(err)
	}
	entry := InventoryLog{
		ID: uuid.NewString(), VariantID: variantID, ProductID: variant.ProductID,
		SKU: variant.SKU, Delta: delta, Reason: reason, By: by, At: time.Now().UTC(),
	}
	_ = s.inventoryLogs.Create(ctx, entry)
	updated, err := s.variants.FindByID(ctx, variantID)
	return updated, entry, mapRepoErr(err)
}

// ListInventoryLogs returns audit rows (newest first), optionally filtered.
func (s *Service) ListInventoryLogs(ctx context.Context, f InventoryFilter) ([]InventoryLog, error) {
	filter := bson.M{}
	if f.VariantID != "" {
		filter["variant_id"] = f.VariantID
	}
	if f.ProductID != "" {
		filter["product_id"] = f.ProductID
	}
	if f.OrderID != "" {
		filter["order_id"] = f.OrderID
	}
	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	return s.inventoryLogs.FindAll(ctx, filter, database.Page{
		Limit: int64(limit), Sort: bson.D{{Key: "at", Value: -1}},
	})
}

// VariantInventoryRow is one row of the admin inventory view.
type VariantInventoryRow struct {
	ProductVariant `bson:",inline"`
	ProductName    string `json:"product_name" bson:"product_name"`
	ProductID      string `json:"product_id" bson:"product_id"`
}

// ListInventory aggregates every variant with its product name, sorted by
// sellable availability ascending (scarcest first). Includes inactive
// variants — admins manage their stock too.
func (s *Service) ListInventory(ctx context.Context) ([]VariantInventoryRow, error) {
	cursor, err := s.variants.Collection().Aggregate(ctx, bson.A{
		bson.M{"$sort": bson.M{"product_id": 1}},
		bson.M{"$lookup": bson.M{
			"from":         "store_products",
			"localField":   "product_id",
			"foreignField": "_id",
			"as":           "product",
		}},
		bson.M{"$unwind": bson.M{"path": "$product", "preserveNullAndEmptyArrays": true}},
		bson.M{"$addFields": bson.M{
			"product_name": bson.M{"$ifNull": bson.A{"$product.name", "—"}},
			"available":    bson.M{"$subtract": bson.A{"$stock", "$reserved"}},
		}},
		bson.M{"$project": bson.M{"product": 0}},
		bson.M{"$sort": bson.M{"available": 1, "product_name": 1}},
	})
	if err != nil {
		return nil, err
	}
	var rows []VariantInventoryRow
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}
