// Package discovery serves cross-cutting public read aggregations that need
// both venue and booking data. It lives outside both packages because
// booking already imports venue, so venue cannot import booking back.
package discovery

import "sansyar/backend/internal/venue"

type (
	PublicStats struct {
		TotalVenues       int64 `json:"total_venues"`
		TotalReservations int64 `json:"total_reservations"`
	}

	// FeaturedComplex is a published complex enriched with its reservation
	// count, used to rank the homepage's featured-venues row by popularity.
	FeaturedComplex struct {
		venue.ComplexListItem
		BookingCount int64 `json:"booking_count"`
	}
)
