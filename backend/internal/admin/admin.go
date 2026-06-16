// Package admin provides read-only cross-domain aggregation for the super-admin
// platform dashboard (venues with nested halls, owner/customer profiles, and
// rich booking views). It only reads other domains' collections; all mutations
// stay in their own domain packages.
package admin

import (
	"time"

	"sansyar/backend/internal/auth"
	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/payment"
	"sansyar/backend/internal/venue"
)

type (
	// BookingStats summarizes a person's booking activity.
	BookingStats struct {
		Total     int   `json:"total"`
		Confirmed int   `json:"confirmed"`
		Completed int   `json:"completed"`
		Cancelled int   `json:"cancelled"`
		Revenue   int64 `json:"revenue"`
	}

	FavoriteStat struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		Count int    `json:"count"`
	}

	// VenueListItem is a venue (complex) with its halls nested and owner summary.
	VenueListItem struct {
		venue.Complex
		OwnerName       string       `json:"owner_name"`
		OwnerPhone      string       `json:"owner_phone"`
		OwnerNationalID string       `json:"owner_national_id"`
		OwnerAddress    string       `json:"owner_address"`
		Halls           []venue.Hall `json:"halls"`
		HallCount       int          `json:"hall_count"`
		SlotCount       int          `json:"slot_count"`
		BookingCount    int          `json:"booking_count"`
	}

	OwnerListItem struct {
		auth.User
		VenueCount     int       `json:"venue_count"`
		BookingCount   int       `json:"booking_count"`
		LastActivityAt time.Time `json:"last_activity_at"`
	}

	OwnerDetail struct {
		auth.User
		Venues         []venue.Complex `json:"venues"`
		Stats          BookingStats    `json:"stats"`
		LastActivityAt time.Time       `json:"last_activity_at"`
	}

	CustomerListItem struct {
		auth.User
		BookingCount   int       `json:"booking_count"`
		CancelledCount int       `json:"cancelled_count"`
		LastActivityAt time.Time `json:"last_activity_at"`
	}

	CustomerDetail struct {
		auth.User
		Bookings       []EnrichedBooking `json:"bookings"`
		Cancellations  []EnrichedBooking `json:"cancellations"`
		Stats          BookingStats      `json:"stats"`
		FavoriteVenues []FavoriteStat    `json:"favorite_venues"`
		FavoriteSports []FavoriteStat    `json:"favorite_sports"`
		LastActivityAt time.Time         `json:"last_activity_at"`
	}

	// EnrichedBooking is a booking with the human-readable names admins need.
	EnrichedBooking struct {
		booking.Booking
		CustomerName  string `json:"customer_name"`
		CustomerPhone string `json:"customer_phone"`
		ComplexName   string `json:"complex_name"`
		HallName      string `json:"hall_name"`
		SportName     string `json:"sport_name"`
	}

	BookingDetail struct {
		EnrichedBooking
		Customer *auth.User        `json:"customer"`
		Complex  *venue.Complex    `json:"complex"`
		Hall     *venue.Hall       `json:"hall"`
		Payments []payment.Payment `json:"payments"`
	}

	PaginatedBookings struct {
		Items []EnrichedBooking `json:"items"`
		Total int64             `json:"total"`
		Page  int               `json:"page"`
		Limit int               `json:"limit"`
	}

	BookingFilter struct {
		Status        string
		PaymentStatus string
		ComplexID     string
		CustomerID    string
		Query         string
		From          time.Time
		To            time.Time
		Page          int
		Limit         int
	}
)
