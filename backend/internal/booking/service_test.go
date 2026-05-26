package booking

import (
	"testing"
	"time"
)

func TestCalculateRefund(t *testing.T) {
	start := time.Date(2026, 6, 1, 18, 0, 0, 0, time.UTC)
	tests := []struct {
		name       string
		cancelled  time.Time
		wantMode   string
		wantRefund int64
	}{
		{name: "free before deadline", cancelled: start.Add(-25 * time.Hour), wantMode: "free", wantRefund: 1000},
		{name: "partial before deadline", cancelled: start.Add(-10 * time.Hour), wantMode: "partial", wantRefund: 500},
		{name: "none near start", cancelled: start.Add(-2 * time.Hour), wantMode: "none", wantRefund: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalculateRefund(1000, start, tt.cancelled, 24, 6, 50)
			if got.Mode != tt.wantMode || got.RefundAmount != tt.wantRefund {
				t.Fatalf("got %+v", got)
			}
		})
	}
}
