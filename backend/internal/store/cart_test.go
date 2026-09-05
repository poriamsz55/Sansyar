package store

import (
	"reflect"
	"testing"
)

func TestMergeItems(t *testing.T) {
	a := []CartItem{{VariantID: "v1", Qty: 2}, {VariantID: "v2", Qty: 1}}
	b := []CartItem{{VariantID: "v1", Qty: 3}, {VariantID: "v3", Qty: 5}}
	got := mergeItems(a, b)
	want := []CartItem{{VariantID: "v1", Qty: 5}, {VariantID: "v2", Qty: 1}, {VariantID: "v3", Qty: 5}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v want %+v", got, want)
	}

	// Quantities cap at maxCartQty.
	capped := mergeItems([]CartItem{{VariantID: "v1", Qty: 90}}, []CartItem{{VariantID: "v1", Qty: 90}})
	if capped[0].Qty != maxCartQty {
		t.Fatalf("capped qty = %d, want %d", capped[0].Qty, maxCartQty)
	}
}
