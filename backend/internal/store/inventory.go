package store

import "time"

// InventoryLog records every stock mutation (reservation, sale, release,
// restock, manual adjustment) for auditing and the admin inventory view.
type InventoryLog struct {
	ID        string    `json:"id" bson:"_id"`
	VariantID string    `json:"variant_id" bson:"variant_id"`
	ProductID string    `json:"product_id" bson:"product_id"`
	SKU       string    `json:"sku" bson:"sku"`
	Delta     int       `json:"delta"`                                        // +restock / -sale / +-adjustment
	Reserved  int       `json:"reserved,omitempty" bson:"reserved,omitempty"` // change to reserved qty (if any)
	Reason    string    `json:"reason" bson:"reason"`
	OrderID   string    `json:"order_id,omitempty" bson:"order_id,omitempty"`
	By        string    `json:"by" bson:"by"`
	At        time.Time `json:"at" bson:"at"`
}

type (
	// AdjustStockRequest is an admin manual stock adjustment.
	AdjustStockRequest struct {
		Delta  int    `json:"delta" validate:"required,ne=0"`
		Reason string `json:"reason" validate:"required,min=3"`
	}

	InventoryFilter struct {
		VariantID string
		ProductID string
		OrderID   string
		Limit     int
	}
)
