package discovery

import (
	"context"
	"sort"

	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/venue"
	"sansyar/backend/pkg/database"
)

const defaultFeaturedLimit = 8
const maxFeaturedLimit = 24

// excludedReservationStatuses are booking statuses that never became a real
// reservation (cancelled or expired before it happened), so they're left out
// of every public "reservations" count.
var excludedReservationStatuses = bson.A{
	booking.StatusCancelledByUser,
	booking.StatusCancelledByOwner,
	booking.StatusExpired,
}

type Service struct {
	complexes *database.Repository[venue.Complex]
	bookings  *database.Repository[booking.Booking]
	venues    *venue.Service
}

func NewService(complexes *database.Repository[venue.Complex], bookings *database.Repository[booking.Booking], venues *venue.Service) *Service {
	return &Service{complexes: complexes, bookings: bookings, venues: venues}
}

func reservationFilter(extra bson.M) bson.M {
	filter := bson.M{"status": bson.M{"$nin": excludedReservationStatuses}}
	for k, v := range extra {
		filter[k] = v
	}
	return filter
}

func (s *Service) publicStats(ctx context.Context) (PublicStats, error) {
	totalVenues, err := s.complexes.Count(ctx, bson.M{"status": venue.ComplexPublished})
	if err != nil {
		return PublicStats{}, err
	}
	totalReservations, err := s.bookings.Count(ctx, reservationFilter(nil))
	if err != nil {
		return PublicStats{}, err
	}
	return PublicStats{TotalVenues: totalVenues, TotalReservations: totalReservations}, nil
}

func (s *Service) bookingCountForComplex(ctx context.Context, complexID string) (int64, error) {
	return s.bookings.Count(ctx, reservationFilter(bson.M{"complex_id": complexID}))
}

func (s *Service) featuredComplexes(ctx context.Context, limit int) ([]FeaturedComplex, error) {
	if limit <= 0 || limit > maxFeaturedLimit {
		limit = defaultFeaturedLimit
	}

	items, err := s.venues.ListPublished(ctx, 200)
	if err != nil {
		return nil, err
	}

	counts, err := s.bookingCountsByComplex(ctx, items)
	if err != nil {
		return nil, err
	}

	featured := make([]FeaturedComplex, 0, len(items))
	for _, c := range items {
		summary, err := s.venues.SummarizeComplex(ctx, c)
		if err != nil {
			return nil, err
		}
		featured = append(featured, FeaturedComplex{ComplexListItem: summary, BookingCount: counts[c.ID]})
	}

	sort.Slice(featured, func(i, j int) bool {
		if featured[i].BookingCount != featured[j].BookingCount {
			return featured[i].BookingCount > featured[j].BookingCount
		}
		return featured[i].RatingAvg > featured[j].RatingAvg
	})
	if len(featured) > limit {
		featured = featured[:limit]
	}
	return featured, nil
}

func (s *Service) bookingCountsByComplex(ctx context.Context, complexes []venue.Complex) (map[string]int64, error) {
	counts := map[string]int64{}
	if len(complexes) == 0 {
		return counts, nil
	}
	ids := make(bson.A, 0, len(complexes))
	for _, c := range complexes {
		ids = append(ids, c.ID)
	}

	cursor, err := s.bookings.Collection().Aggregate(ctx, bson.A{
		bson.M{"$match": reservationFilter(bson.M{"complex_id": bson.M{"$in": ids}})},
		bson.M{"$group": bson.M{"_id": "$complex_id", "count": bson.M{"$sum": 1}}},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var rows []struct {
		ID    string `bson:"_id"`
		Count int64  `bson:"count"`
	}
	if err := cursor.All(ctx, &rows); err != nil {
		return nil, err
	}
	for _, r := range rows {
		counts[r.ID] = r.Count
	}
	return counts, nil
}
