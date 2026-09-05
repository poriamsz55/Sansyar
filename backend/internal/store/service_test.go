package store

import (
	"reflect"
	"testing"
)

func TestNormalizeSlug(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		fallback string
		want     string
	}{
		{name: "latin name", raw: "Pro Football Size 5", fallback: "", want: "pro-football-size-5"},
		{name: "persian name kept", raw: "توپ فوتبال", fallback: "", want: "توپ-فوتبال"},
		{name: "strips unsafe chars", raw: "Ball (Size 5)!!", fallback: "", want: "ball-size-5"},
		{name: "falls back", raw: "", fallback: " Running Shorts ", want: "running-shorts"},
		{name: "collapses dashes", raw: "a -- b", fallback: "", want: "a-b"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NormalizeSlug(tt.raw, tt.fallback); got != tt.want {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}

func TestNormalizeImages(t *testing.T) {
	got := normalizeImages([]ProductImage{
		{URL: " a.jpg "},
		{URL: "b.jpg", IsPrimary: true},
		{URL: "c.jpg", IsPrimary: true},
	})
	want := []ProductImage{{URL: "a.jpg"}, {URL: "b.jpg", IsPrimary: true}, {URL: "c.jpg"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v want %+v", got, want)
	}
	if primaryImage(want) != "b.jpg" {
		t.Fatalf("primary image should be b.jpg")
	}

	// No explicit primary → the first image becomes primary.
	got = normalizeImages([]ProductImage{{URL: "x.jpg"}, {URL: "y.jpg"}})
	if !got[0].IsPrimary || got[1].IsPrimary {
		t.Fatalf("first image must be primary: %+v", got)
	}

	if normalizeImages(nil) == nil {
		t.Fatalf("normalizeImages(nil) must return an empty slice, not nil")
	}
}

func TestSummarize(t *testing.T) {
	variants := []ProductVariant{
		{ID: "1", Price: 1_000_000, OriginalPrice: 1_200_000, Stock: 5, Reserved: 2},
		{ID: "2", Price: 800_000, Stock: 3, Reserved: 3},
	}
	got := summarize(variants)
	if got.PriceFrom != 800_000 {
		t.Fatalf("price_from = %d, want 800000", got.PriceFrom)
	}
	if got.OriginalFrom != 1_200_000 {
		t.Fatalf("original_from = %d, want 1200000", got.OriginalFrom)
	}
	if got.DiscountMax != 16 { // (1.2M-1M)/1.2M
		t.Fatalf("discount_max = %d, want 16", got.DiscountMax)
	}
	if got.TotalStock != 8 || got.AvailableStock != 3 {
		t.Fatalf("stock totals wrong: %+v", got)
	}
}

func TestDiscountPercent(t *testing.T) {
	tests := []struct {
		price, original int64
		want            int
	}{
		{1_000_000, 1_200_000, 16},
		{1_200_000, 1_000_000, 0}, // original below price → no discount
		{500_000, 0, 0},           // no original price
		{0, 1_000_000, 0},         // free/invalid price
	}
	for _, tt := range tests {
		if got := discountPercent(tt.price, tt.original); got != tt.want {
			t.Fatalf("discountPercent(%d,%d) = %d, want %d", tt.price, tt.original, got, tt.want)
		}
	}
}

func TestNormalizePage(t *testing.T) {
	if page, limit := normalizePage(0, 0); page != 1 || limit != 12 {
		t.Fatalf("defaults wrong: %d/%d", page, limit)
	}
	if page, limit := normalizePage(-3, 500); page != 1 || limit != 12 {
		t.Fatalf("invalid values must fall back: %d/%d", page, limit)
	}
	if page, limit := normalizePage(3, 24); page != 3 || limit != 24 {
		t.Fatalf("valid values must pass through: %d/%d", page, limit)
	}
}
