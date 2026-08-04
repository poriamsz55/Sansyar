package finance

import "time"

type (
	// TrendPoint is one day's value in a time series.
	TrendPoint struct {
		Date  string `json:"date"` // YYYY-MM-DD
		Value int64  `json:"value"`
	}

	CountStat struct {
		Label string `json:"label"`
		Count int64  `json:"count"`
	}

	RevenueStat struct {
		Label   string `json:"label"`
		Revenue int64  `json:"revenue"`
	}

	PeriodComparison struct {
		Current   int64   `json:"current"`
		Previous  int64   `json:"previous"`
		ChangePct float64 `json:"change_pct"`
	}

	OwnerSummary struct {
		TotalRevenue       int64 `json:"total_revenue"`
		OnlinePayments     int64 `json:"online_payments"`
		Deposits           int64 `json:"deposits"`
		Refunds            int64 `json:"refunds"`
		PlatformCommission int64 `json:"platform_commission"`
		NetSettlement      int64 `json:"net_settlement"`
	}

	OwnerAnalytics struct {
		TotalReservations     int64        `json:"total_reservations"`
		TotalRevenue          int64        `json:"total_revenue"`
		CancelledReservations int64        `json:"cancelled_reservations"`
		HolidayClosureDays    int64        `json:"holiday_closure_days"`
		TotalRefundAmount     int64        `json:"total_refund_amount"`
		RefundedCount         int64        `json:"refunded_count"`
		RevenueTrend          []TrendPoint `json:"revenue_trend"`
		ReservationTrend      []TrendPoint `json:"reservation_trend"`
	}

	Transaction struct {
		ID     string    `json:"id"`
		Date   time.Time `json:"date"`
		Amount int64     `json:"amount"`
		Type   string    `json:"type"`
		Status string    `json:"status"`
	}

	AdminSummary struct {
		PlatformRevenue int64 `json:"platform_revenue"`
		FailedPayments  int64 `json:"failed_payments"`
		// No payout/settlement system exists yet, so this is honestly zero
		// rather than a fabricated number.
		PendingSettlements int64 `json:"pending_settlements"`
	}

	AdminAnalytics struct {
		TotalRevenue               int64            `json:"total_revenue"`
		TotalReservations          int64            `json:"total_reservations"`
		TotalCustomers             int64            `json:"total_customers"`
		TotalVenues                int64            `json:"total_venues"`
		RevenueTrend               []TrendPoint     `json:"revenue_trend"`
		ReservationTrend           []TrendPoint     `json:"reservation_trend"`
		RevenueByPeriod            PeriodComparison `json:"revenue_by_period"`
		ReservationsBySport        []CountStat      `json:"reservations_by_sport"`
		ReservationsByCity         []CountStat      `json:"reservations_by_city"`
		ReservationsByStatus       []CountStat      `json:"reservations_by_status"`
		TopVenues                  []RevenueStat    `json:"top_venues"`
		CustomerDistributionByCity []CountStat      `json:"customer_distribution_by_city"`
	}
)
