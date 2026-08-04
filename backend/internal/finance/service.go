package finance

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/payment"
	"sansyar/backend/internal/venue"
	"sansyar/backend/pkg/database"
)

// excludedReservationStatuses mirrors internal/discovery's definition of a
// "real" reservation — bookings cancelled or expired before they ever
// happened don't count toward reservation/revenue stats.
var excludedReservationStatuses = bson.A{
	booking.StatusCancelledByUser,
	booking.StatusCancelledByOwner,
	booking.StatusExpired,
}

var revenueStatuses = bson.A{booking.StatusConfirmed, booking.StatusCompleted}

const (
	defaultTrendDays = 30
	maxTrendDays     = 180
)

type Service struct {
	bookings  *database.Repository[booking.Booking]
	slots     *database.Repository[venue.Slot]
	complexes *database.Repository[venue.Complex]
	payments  *database.Repository[payment.Payment]
	venues    *venue.Service
}

func NewService(
	bookings *database.Repository[booking.Booking],
	slots *database.Repository[venue.Slot],
	complexes *database.Repository[venue.Complex],
	payments *database.Repository[payment.Payment],
	venues *venue.Service,
) *Service {
	return &Service{bookings: bookings, slots: slots, complexes: complexes, payments: payments, venues: venues}
}

func reservationFilter(extra bson.M) bson.M {
	return mergeBson(bson.M{"status": bson.M{"$nin": excludedReservationStatuses}}, extra)
}

func mergeBson(base bson.M, extra bson.M) bson.M {
	merged := make(bson.M, len(base)+len(extra))
	for k, v := range base {
		merged[k] = v
	}
	for k, v := range extra {
		merged[k] = v
	}
	return merged
}

func toBsonA(ids []string) bson.A {
	a := make(bson.A, 0, len(ids))
	for _, id := range ids {
		a = append(a, id)
	}
	return a
}

// ---- generic aggregation helpers ------------------------------------------

func (s *Service) sumField(ctx context.Context, filter bson.M, field string) (int64, error) {
	cursor, err := s.bookings.Collection().Aggregate(ctx, bson.A{
		bson.M{"$match": filter},
		bson.M{"$group": bson.M{"_id": nil, "total": bson.M{"$sum": "$" + field}}},
	})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Total int64 `bson:"total"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Total, nil
}

func (s *Service) distinctCustomerCount(ctx context.Context, filter bson.M) (int64, error) {
	cursor, err := s.bookings.Collection().Aggregate(ctx, bson.A{
		bson.M{"$match": filter},
		bson.M{"$group": bson.M{"_id": "$customer_id"}},
		bson.M{"$count": "total"},
	})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Total int64 `bson:"total"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Total, nil
}

func (s *Service) aggregateCounts(ctx context.Context, pipeline bson.A) ([]CountStat, error) {
	cursor, err := s.bookings.Collection().Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []CountStat
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []CountStat{}
	}
	return rows, nil
}

func (s *Service) aggregateRevenue(ctx context.Context, pipeline bson.A) ([]RevenueStat, error) {
	cursor, err := s.bookings.Collection().Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var rows []RevenueStat
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	if rows == nil {
		rows = []RevenueStat{}
	}
	return rows, nil
}

// dailyTrend buckets bookings matching baseMatch (plus the [from,to) range)
// by calendar day (UTC, on created_at), returning parallel reservation-count
// and revenue series with every day present (zero-filled gaps included) so
// charts get a continuous axis.
func (s *Service) dailyTrend(ctx context.Context, baseMatch bson.M, from, to time.Time) ([]TrendPoint, []TrendPoint, error) {
	if to.IsZero() {
		to = time.Now().UTC()
	}
	if from.IsZero() {
		from = to.AddDate(0, 0, -(defaultTrendDays - 1))
	}
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.UTC)
	toExclusive := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, 1)
	days := int(toExclusive.Sub(from).Hours() / 24)
	if days > maxTrendDays {
		from = toExclusive.AddDate(0, 0, -maxTrendDays)
		days = maxTrendDays
	}
	if days < 1 {
		days = 1
	}

	filter := mergeBson(baseMatch, bson.M{"created_at": bson.M{"$gte": from, "$lt": toExclusive}})
	cursor, err := s.bookings.Collection().Aggregate(ctx, bson.A{
		bson.M{"$match": filter},
		bson.M{"$group": bson.M{
			"_id":     bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$created_at"}},
			"count":   bson.M{"$sum": 1},
			"revenue": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$in": bson.A{"$status", revenueStatuses}}, "$final_amount", 0}}},
		}},
	})
	if err != nil {
		return nil, nil, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Day     string `bson:"_id"`
		Count   int64  `bson:"count"`
		Revenue int64  `bson:"revenue"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, nil, err
	}
	byDay := make(map[string]struct {
		Count   int64
		Revenue int64
	}, len(rows))
	for _, r := range rows {
		byDay[r.Day] = struct {
			Count   int64
			Revenue int64
		}{r.Count, r.Revenue}
	}

	reservationTrend := make([]TrendPoint, 0, days)
	revenueTrend := make([]TrendPoint, 0, days)
	for i := 0; i < days; i++ {
		day := from.AddDate(0, 0, i).Format("2006-01-02")
		row := byDay[day]
		reservationTrend = append(reservationTrend, TrendPoint{Date: day, Value: row.Count})
		revenueTrend = append(revenueTrend, TrendPoint{Date: day, Value: row.Revenue})
	}
	return reservationTrend, revenueTrend, nil
}

// ---- owner-facing -----------------------------------------------------

func (s *Service) ownerSummary(ctx context.Context, ownerID string) (OwnerSummary, error) {
	ids, err := s.venues.ComplexIDsForOwner(ctx, ownerID)
	if err != nil {
		return OwnerSummary{}, err
	}
	if len(ids) == 0 {
		return OwnerSummary{}, nil
	}
	scope := bson.M{"complex_id": bson.M{"$in": toBsonA(ids)}}

	totalRevenue, err := s.sumField(ctx, mergeBson(scope, bson.M{"status": bson.M{"$in": revenueStatuses}}), "final_amount")
	if err != nil {
		return OwnerSummary{}, err
	}
	onlinePayments, err := s.sumField(ctx, mergeBson(scope, bson.M{"status": bson.M{"$in": revenueStatuses}, "payment_type": booking.PaymentFullOnline}), "final_amount")
	if err != nil {
		return OwnerSummary{}, err
	}
	deposits, err := s.sumField(ctx, mergeBson(scope, bson.M{"payment_type": booking.PaymentDeposit}), "deposit_amount")
	if err != nil {
		return OwnerSummary{}, err
	}
	refunds, err := s.sumField(ctx, mergeBson(scope, bson.M{"refund_amount": bson.M{"$gt": 0}}), "refund_amount")
	if err != nil {
		return OwnerSummary{}, err
	}

	// No commission/payout system exists yet, so commission is genuinely
	// zero — net settlement is simply revenue collected minus refunds paid.
	return OwnerSummary{
		TotalRevenue:       totalRevenue,
		OnlinePayments:     onlinePayments,
		Deposits:           deposits,
		Refunds:            refunds,
		PlatformCommission: 0,
		NetSettlement:      totalRevenue - refunds,
	}, nil
}

func (s *Service) holidayClosureDays(ctx context.Context, complexIDs []string) (int64, error) {
	cursor, err := s.slots.Collection().Aggregate(ctx, bson.A{
		bson.M{"$match": bson.M{
			"complex_id": bson.M{"$in": toBsonA(complexIDs)},
			"status":     bson.M{"$in": bson.A{venue.SlotHoliday, venue.SlotClosed, venue.SlotMaintenance}},
		}},
		bson.M{"$group": bson.M{"_id": bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$starts_at"}}}},
		bson.M{"$count": "days"},
	})
	if err != nil {
		return 0, err
	}
	defer cursor.Close(ctx)
	var rows []struct {
		Days int64 `bson:"days"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return 0, err
	}
	if len(rows) == 0 {
		return 0, nil
	}
	return rows[0].Days, nil
}

func (s *Service) ownerAnalytics(ctx context.Context, ownerID string) (OwnerAnalytics, error) {
	ids, err := s.venues.ComplexIDsForOwner(ctx, ownerID)
	if err != nil {
		return OwnerAnalytics{}, err
	}
	if len(ids) == 0 {
		return OwnerAnalytics{}, nil
	}
	scope := bson.M{"complex_id": bson.M{"$in": toBsonA(ids)}}

	totalReservations, err := s.bookings.Count(ctx, reservationFilter(scope))
	if err != nil {
		return OwnerAnalytics{}, err
	}
	totalRevenue, err := s.sumField(ctx, mergeBson(scope, bson.M{"status": bson.M{"$in": revenueStatuses}}), "final_amount")
	if err != nil {
		return OwnerAnalytics{}, err
	}
	cancelled, err := s.bookings.Count(ctx, mergeBson(scope, bson.M{"status": bson.M{"$in": bson.A{booking.StatusCancelledByUser, booking.StatusCancelledByOwner}}}))
	if err != nil {
		return OwnerAnalytics{}, err
	}
	totalRefund, err := s.sumField(ctx, mergeBson(scope, bson.M{"refund_amount": bson.M{"$gt": 0}}), "refund_amount")
	if err != nil {
		return OwnerAnalytics{}, err
	}
	refundedCount, err := s.bookings.Count(ctx, mergeBson(scope, bson.M{"refund_amount": bson.M{"$gt": 0}}))
	if err != nil {
		return OwnerAnalytics{}, err
	}
	holidayDays, err := s.holidayClosureDays(ctx, ids)
	if err != nil {
		return OwnerAnalytics{}, err
	}
	reservationTrend, revenueTrend, err := s.dailyTrend(ctx, reservationFilter(scope), time.Time{}, time.Time{})
	if err != nil {
		return OwnerAnalytics{}, err
	}

	return OwnerAnalytics{
		TotalReservations:     totalReservations,
		TotalRevenue:          totalRevenue,
		CancelledReservations: cancelled,
		HolidayClosureDays:    holidayDays,
		TotalRefundAmount:     totalRefund,
		RefundedCount:         refundedCount,
		RevenueTrend:          revenueTrend,
		ReservationTrend:      reservationTrend,
	}, nil
}

func (s *Service) ownerTransactions(ctx context.Context, ownerID string) ([]Transaction, error) {
	ids, err := s.venues.ComplexIDsForOwner(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []Transaction{}, nil
	}
	items, err := s.bookings.FindAll(ctx, bson.M{"complex_id": bson.M{"$in": toBsonA(ids)}}, database.Page{Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return nil, err
	}
	out := make([]Transaction, 0, len(items))
	for _, b := range items {
		out = append(out, Transaction{ID: b.ID, Date: b.CreatedAt, Amount: b.FinalAmount, Type: b.PaymentType, Status: b.Status})
	}
	return out, nil
}

// ---- admin-facing -------------------------------------------------------

func dateRangeFilter(from, to time.Time) bson.M {
	if from.IsZero() && to.IsZero() {
		return bson.M{}
	}
	rng := bson.M{}
	if !from.IsZero() {
		rng["$gte"] = from
	}
	if !to.IsZero() {
		rng["$lt"] = to
	}
	return bson.M{"created_at": rng}
}

func (s *Service) adminSummary(ctx context.Context) (AdminSummary, error) {
	revenue, err := s.sumField(ctx, bson.M{"status": bson.M{"$in": revenueStatuses}}, "final_amount")
	if err != nil {
		return AdminSummary{}, err
	}
	failedPayments, err := s.payments.Count(ctx, bson.M{"status": payment.StatusFailed})
	if err != nil {
		return AdminSummary{}, err
	}
	return AdminSummary{PlatformRevenue: revenue, FailedPayments: failedPayments, PendingSettlements: 0}, nil
}

func (s *Service) revenueByPeriod(ctx context.Context, from, to time.Time) (PeriodComparison, error) {
	if to.IsZero() {
		to = time.Now().UTC()
	}
	if from.IsZero() {
		from = to.AddDate(0, 0, -defaultTrendDays)
	}
	duration := to.Sub(from)
	prevFrom := from.Add(-duration)

	current, err := s.sumField(ctx, bson.M{"created_at": bson.M{"$gte": from, "$lt": to}, "status": bson.M{"$in": revenueStatuses}}, "final_amount")
	if err != nil {
		return PeriodComparison{}, err
	}
	previous, err := s.sumField(ctx, bson.M{"created_at": bson.M{"$gte": prevFrom, "$lt": from}, "status": bson.M{"$in": revenueStatuses}}, "final_amount")
	if err != nil {
		return PeriodComparison{}, err
	}
	var changePct float64
	switch {
	case previous > 0:
		changePct = (float64(current) - float64(previous)) / float64(previous) * 100
	case current > 0:
		changePct = 100
	}
	return PeriodComparison{Current: current, Previous: previous, ChangePct: changePct}, nil
}

func (s *Service) reservationsBySport(ctx context.Context, rangeFilter bson.M) ([]CountStat, error) {
	return s.aggregateCounts(ctx, bson.A{
		bson.M{"$match": reservationFilter(rangeFilter)},
		bson.M{"$group": bson.M{"_id": "$sport_id", "count": bson.M{"$sum": 1}}},
		bson.M{"$lookup": bson.M{"from": "sports", "localField": "_id", "foreignField": "_id", "as": "sport"}},
		bson.M{"$unwind": bson.M{"path": "$sport", "preserveNullAndEmptyArrays": true}},
		bson.M{"$project": bson.M{"label": bson.M{"$ifNull": bson.A{"$sport.name", "$_id"}}, "count": 1, "_id": 0}},
		bson.M{"$sort": bson.M{"count": -1}},
		bson.M{"$limit": 10},
	})
}

func (s *Service) reservationsByCity(ctx context.Context, rangeFilter bson.M) ([]CountStat, error) {
	return s.aggregateCounts(ctx, bson.A{
		bson.M{"$match": reservationFilter(rangeFilter)},
		bson.M{"$lookup": bson.M{"from": "complexes", "localField": "complex_id", "foreignField": "_id", "as": "complex"}},
		bson.M{"$unwind": "$complex"},
		bson.M{"$group": bson.M{"_id": "$complex.city", "count": bson.M{"$sum": 1}}},
		bson.M{"$project": bson.M{"label": "$_id", "count": 1, "_id": 0}},
		bson.M{"$sort": bson.M{"count": -1}},
		bson.M{"$limit": 10},
	})
}

func (s *Service) reservationsByStatus(ctx context.Context, rangeFilter bson.M) ([]CountStat, error) {
	return s.aggregateCounts(ctx, bson.A{
		bson.M{"$match": rangeFilter},
		bson.M{"$group": bson.M{"_id": "$status", "count": bson.M{"$sum": 1}}},
		bson.M{"$project": bson.M{"label": "$_id", "count": 1, "_id": 0}},
		bson.M{"$sort": bson.M{"count": -1}},
	})
}

func (s *Service) topVenues(ctx context.Context, rangeFilter bson.M) ([]RevenueStat, error) {
	return s.aggregateRevenue(ctx, bson.A{
		bson.M{"$match": mergeBson(rangeFilter, bson.M{"status": bson.M{"$in": revenueStatuses}})},
		bson.M{"$group": bson.M{"_id": "$complex_id", "revenue": bson.M{"$sum": "$final_amount"}}},
		bson.M{"$sort": bson.M{"revenue": -1}},
		bson.M{"$limit": 10},
		bson.M{"$lookup": bson.M{"from": "complexes", "localField": "_id", "foreignField": "_id", "as": "complex"}},
		bson.M{"$unwind": "$complex"},
		bson.M{"$project": bson.M{"label": "$complex.name", "revenue": 1, "_id": 0}},
	})
}

func (s *Service) customerDistributionByCity(ctx context.Context, rangeFilter bson.M) ([]CountStat, error) {
	return s.aggregateCounts(ctx, bson.A{
		bson.M{"$match": reservationFilter(rangeFilter)},
		bson.M{"$lookup": bson.M{"from": "complexes", "localField": "complex_id", "foreignField": "_id", "as": "complex"}},
		bson.M{"$unwind": "$complex"},
		bson.M{"$group": bson.M{"_id": bson.M{"city": "$complex.city", "customer": "$customer_id"}}},
		bson.M{"$group": bson.M{"_id": "$_id.city", "count": bson.M{"$sum": 1}}},
		bson.M{"$project": bson.M{"label": "$_id", "count": 1, "_id": 0}},
		bson.M{"$sort": bson.M{"count": -1}},
		bson.M{"$limit": 10},
	})
}

func (s *Service) adminAnalytics(ctx context.Context, from, to time.Time) (AdminAnalytics, error) {
	rangeFilter := dateRangeFilter(from, to)

	totalReservations, err := s.bookings.Count(ctx, reservationFilter(rangeFilter))
	if err != nil {
		return AdminAnalytics{}, err
	}
	totalRevenue, err := s.sumField(ctx, mergeBson(rangeFilter, bson.M{"status": bson.M{"$in": revenueStatuses}}), "final_amount")
	if err != nil {
		return AdminAnalytics{}, err
	}
	totalCustomers, err := s.distinctCustomerCount(ctx, reservationFilter(rangeFilter))
	if err != nil {
		return AdminAnalytics{}, err
	}
	totalVenues, err := s.complexes.Count(ctx, bson.M{"status": venue.ComplexPublished})
	if err != nil {
		return AdminAnalytics{}, err
	}
	reservationTrend, revenueTrend, err := s.dailyTrend(ctx, reservationFilter(bson.M{}), from, to)
	if err != nil {
		return AdminAnalytics{}, err
	}
	periodComparison, err := s.revenueByPeriod(ctx, from, to)
	if err != nil {
		return AdminAnalytics{}, err
	}
	bySport, err := s.reservationsBySport(ctx, rangeFilter)
	if err != nil {
		return AdminAnalytics{}, err
	}
	byCity, err := s.reservationsByCity(ctx, rangeFilter)
	if err != nil {
		return AdminAnalytics{}, err
	}
	byStatus, err := s.reservationsByStatus(ctx, rangeFilter)
	if err != nil {
		return AdminAnalytics{}, err
	}
	top, err := s.topVenues(ctx, rangeFilter)
	if err != nil {
		return AdminAnalytics{}, err
	}
	customersByCity, err := s.customerDistributionByCity(ctx, rangeFilter)
	if err != nil {
		return AdminAnalytics{}, err
	}

	return AdminAnalytics{
		TotalRevenue:               totalRevenue,
		TotalReservations:          totalReservations,
		TotalCustomers:             totalCustomers,
		TotalVenues:                totalVenues,
		RevenueTrend:               revenueTrend,
		ReservationTrend:           reservationTrend,
		RevenueByPeriod:            periodComparison,
		ReservationsBySport:        bySport,
		ReservationsByCity:         byCity,
		ReservationsByStatus:       byStatus,
		TopVenues:                  top,
		CustomerDistributionByCity: customersByCity,
	}, nil
}
