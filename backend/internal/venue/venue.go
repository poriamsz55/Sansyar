package venue

import "time"

const (
	ComplexDraft           = "draft"
	ComplexPendingApproval = "pending_approval"
	ComplexApproved        = "approved"
	ComplexRejected        = "rejected"
	ComplexSuspended       = "suspended"

	SlotAvailable   = "available"
	SlotReserved    = "reserved"
	SlotBlocked     = "blocked"
	SlotMaintenance = "maintenance"
	SlotExpired     = "expired"
)

type (
	GeoJSONPoint struct {
		Type        string    `json:"type" bson:"type"`
		Coordinates []float64 `json:"coordinates" bson:"coordinates"`
	}

	CancellationPolicy struct {
		FreeBeforeHours    int `json:"free_before_hours" bson:"free_before_hours"`
		PartialBeforeHours int `json:"partial_before_hours" bson:"partial_before_hours"`
		PartialRefundPct   int `json:"partial_refund_percent" bson:"partial_refund_percent"`
	}

	Complex struct {
		ID                 string             `json:"id" bson:"_id"`
		OwnerID            string             `json:"owner_id" bson:"owner_id"`
		Name               string             `json:"name" bson:"name"`
		Slug               string             `json:"slug" bson:"slug"`
		Description        string             `json:"description" bson:"description"`
		City               string             `json:"city" bson:"city"`
		Neighborhood       string             `json:"neighborhood" bson:"neighborhood"`
		Address            string             `json:"address" bson:"address"`
		Location           GeoJSONPoint       `json:"location" bson:"location"`
		ContactPhone       string             `json:"contact_phone" bson:"contact_phone"`
		Images             []string           `json:"images" bson:"images"`
		Amenities          []string           `json:"amenities" bson:"amenities"`
		Rules              []string           `json:"rules" bson:"rules"`
		CancellationPolicy CancellationPolicy `json:"cancellation_policy" bson:"cancellation_policy"`
		Status             string             `json:"status" bson:"status"`
		RatingAvg          float64            `json:"rating_avg" bson:"rating_avg"`
		RatingCount        int                `json:"rating_count" bson:"rating_count"`
		CreatedAt          time.Time          `json:"created_at" bson:"created_at"`
		UpdatedAt          time.Time          `json:"updated_at" bson:"updated_at"`
	}

	Hall struct {
		ID                string    `json:"id" bson:"_id"`
		ComplexID         string    `json:"complex_id" bson:"complex_id"`
		Name              string    `json:"name" bson:"name"`
		SupportedSportIDs []string  `json:"supported_sport_ids" bson:"supported_sport_ids"`
		Capacity          int       `json:"capacity" bson:"capacity"`
		IndoorOutdoor     string    `json:"indoor_outdoor" bson:"indoor_outdoor"`
		FloorType         string    `json:"floor_type" bson:"floor_type"`
		Dimensions        string    `json:"dimensions" bson:"dimensions"`
		Amenities         []string  `json:"amenities" bson:"amenities"`
		GenderRule        string    `json:"gender_rule" bson:"gender_rule"`
		BasePrice         int64     `json:"base_price" bson:"base_price"`
		Images            []string  `json:"images" bson:"images"`
		IsActive          bool      `json:"is_active" bson:"is_active"`
		CreatedAt         time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt         time.Time `json:"updated_at" bson:"updated_at"`
	}

	Slot struct {
		ID                         string             `json:"id" bson:"_id"`
		HallID                     string             `json:"hall_id" bson:"hall_id"`
		ComplexID                  string             `json:"complex_id" bson:"complex_id"`
		SportID                    string             `json:"sport_id" bson:"sport_id"`
		StartsAt                   time.Time          `json:"starts_at" bson:"starts_at"`
		EndsAt                     time.Time          `json:"ends_at" bson:"ends_at"`
		DurationMinutes            int                `json:"duration_minutes" bson:"duration_minutes"`
		BasePrice                  int64              `json:"base_price" bson:"base_price"`
		FinalPrice                 int64              `json:"final_price" bson:"final_price"`
		DiscountPercent            int                `json:"discount_percent" bson:"discount_percent"`
		Status                     string             `json:"status" bson:"status"`
		PaymentPolicy              string             `json:"payment_policy" bson:"payment_policy"`
		MinDepositAmount           int64              `json:"min_deposit_amount" bson:"min_deposit_amount"`
		CancellationPolicySnapshot CancellationPolicy `json:"cancellation_policy_snapshot" bson:"cancellation_policy_snapshot"`
		ReservedBy                 string             `json:"reserved_by,omitempty" bson:"reserved_by,omitempty"`
		BookingID                  string             `json:"booking_id,omitempty" bson:"booking_id,omitempty"`
		CreatedBy                  string             `json:"created_by" bson:"created_by"`
		CreatedAt                  time.Time          `json:"created_at" bson:"created_at"`
		UpdatedAt                  time.Time          `json:"updated_at" bson:"updated_at"`
	}

	CreateComplexRequest struct {
		Name               string             `json:"name" validate:"required"`
		Slug               string             `json:"slug" validate:"required"`
		Description        string             `json:"description"`
		City               string             `json:"city" validate:"required"`
		Neighborhood       string             `json:"neighborhood"`
		Address            string             `json:"address" validate:"required"`
		Lat                float64            `json:"lat" validate:"required"`
		Lng                float64            `json:"lng" validate:"required"`
		ContactPhone       string             `json:"contact_phone"`
		Images             []string           `json:"images"`
		Amenities          []string           `json:"amenities"`
		Rules              []string           `json:"rules"`
		CancellationPolicy CancellationPolicy `json:"cancellation_policy"`
	}

	UpdateComplexRequest struct {
		Name         string   `json:"name"`
		Description  string   `json:"description"`
		City         string   `json:"city"`
		Neighborhood string   `json:"neighborhood"`
		Address      string   `json:"address"`
		ContactPhone string   `json:"contact_phone"`
		Images       []string `json:"images"`
		Amenities    []string `json:"amenities"`
		Rules        []string `json:"rules"`
	}

	CreateHallRequest struct {
		Name              string   `json:"name" validate:"required"`
		SupportedSportIDs []string `json:"supported_sport_ids" validate:"required"`
		Capacity          int      `json:"capacity"`
		IndoorOutdoor     string   `json:"indoor_outdoor"`
		FloorType         string   `json:"floor_type"`
		Dimensions        string   `json:"dimensions"`
		Amenities         []string `json:"amenities"`
		GenderRule        string   `json:"gender_rule"`
		BasePrice         int64    `json:"base_price" validate:"required"`
		Images            []string `json:"images"`
	}

	CreateSlotRequest struct {
		HallID           string    `json:"hall_id" validate:"required"`
		ComplexID        string    `json:"complex_id" validate:"required"`
		SportID          string    `json:"sport_id" validate:"required"`
		StartsAt         time.Time `json:"starts_at" validate:"required"`
		EndsAt           time.Time `json:"ends_at" validate:"required"`
		BasePrice        int64     `json:"base_price" validate:"required"`
		DiscountPercent  int       `json:"discount_percent"`
		PaymentPolicy    string    `json:"payment_policy" validate:"required"`
		MinDepositAmount int64     `json:"min_deposit_amount"`
		Status           string    `json:"status"`
	}

	MapVenue struct {
		ID                 string       `json:"id" bson:"_id"`
		Name               string       `json:"name" bson:"name"`
		City               string       `json:"city" bson:"city"`
		Neighborhood       string       `json:"neighborhood" bson:"neighborhood"`
		Location           GeoJSONPoint `json:"location" bson:"location"`
		RatingAvg          float64      `json:"rating_avg" bson:"rating_avg"`
		LowestPrice        int64        `json:"lowest_price" bson:"lowest_price"`
		DiscountPercent    int          `json:"discount_percent" bson:"discount_percent"`
		AvailableSlotCount int          `json:"available_slot_count" bson:"available_slot_count"`
		NearestSlotAt      *time.Time   `json:"nearest_slot_at,omitempty" bson:"nearest_slot_at,omitempty"`
		DistanceMeters     float64      `json:"distance_meters,omitempty" bson:"distance_meters,omitempty"`
	}
)
