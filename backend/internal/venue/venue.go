package venue

import "time"

const (
	ComplexDraft           = "draft"
	ComplexPendingApproval = "pending_approval"
	ComplexApproved        = "approved"
	ComplexRejected        = "rejected"
	ComplexPublished       = "published"
	ComplexSuspended       = "suspended"

	HallPendingApproval = "pending_approval"
	HallApproved        = "approved"
	HallRejected        = "rejected"
	HallPublished       = "published"

	// Slot.Status is the operational state of a session. A session is open for
	// booking while BookedCount is 0; once booked it is locked from time edits.
	SlotAvailable    = "available" // open for booking
	SlotReserved     = "reserved"  // booked/reserved session (locked)
	SlotBlocked      = "blocked"
	SlotClosed       = "closed"
	SlotHoliday      = "holiday"
	SlotSpecialEvent = "special_event"
	SlotMaintenance  = "maintenance"
	SlotExpired      = "expired"
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

	// ComplexChanges is a staged edit to a complex that already passed
	// moderation. The live fields keep serving the public site until a super
	// admin approves the changes; rejecting discards them.
	ComplexChanges struct {
		Name            string        `json:"name,omitempty" bson:"name,omitempty"`
		Description     string        `json:"description,omitempty" bson:"description,omitempty"`
		Province        string        `json:"province,omitempty" bson:"province,omitempty"`
		City            string        `json:"city,omitempty" bson:"city,omitempty"`
		Address         string        `json:"address,omitempty" bson:"address,omitempty"`
		Location        *GeoJSONPoint `json:"location,omitempty" bson:"location,omitempty"`
		ContactPhone    string        `json:"contact_phone,omitempty" bson:"contact_phone,omitempty"`
		ContactMobile   string        `json:"contact_mobile,omitempty" bson:"contact_mobile,omitempty"`
		ContactLandline string        `json:"contact_landline,omitempty" bson:"contact_landline,omitempty"`
		Images          []string      `json:"images,omitempty" bson:"images,omitempty"`
		Amenities       []string      `json:"amenities,omitempty" bson:"amenities,omitempty"`
		Rules           []string      `json:"rules,omitempty" bson:"rules,omitempty"`
		SubmittedAt     time.Time     `json:"submitted_at" bson:"submitted_at"`
	}

	Complex struct {
		ID          string       `json:"id" bson:"_id"`
		OwnerID     string       `json:"owner_id" bson:"owner_id"`
		Name        string       `json:"name" bson:"name"`
		Slug        string       `json:"slug" bson:"slug"`
		Description string       `json:"description" bson:"description"`
		Province    string       `json:"province" bson:"province"`
		City        string       `json:"city" bson:"city"`
		Address     string       `json:"address" bson:"address"`
		Location    GeoJSONPoint `json:"location" bson:"location"`
		// ContactPhone is the legacy single contact field kept for backward
		// compatibility with existing records and public pages. New edits write
		// the split ContactMobile / ContactLandline fields below.
		ContactPhone       string             `json:"contact_phone" bson:"contact_phone"`
		ContactMobile      string             `json:"contact_mobile" bson:"contact_mobile"`
		ContactLandline    string             `json:"contact_landline" bson:"contact_landline"`
		Images             []string           `json:"images" bson:"images"`
		Amenities          []string           `json:"amenities" bson:"amenities"`
		Rules              []string           `json:"rules" bson:"rules"`
		CancellationPolicy CancellationPolicy `json:"cancellation_policy" bson:"cancellation_policy"`
		Status             string             `json:"status" bson:"status"`
		RejectionReason    string             `json:"rejection_reason,omitempty" bson:"rejection_reason,omitempty"`
		PendingChanges     *ComplexChanges    `json:"pending_changes,omitempty" bson:"pending_changes,omitempty"`
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
		Status            string    `json:"status" bson:"status"`
		RejectionReason   string    `json:"rejection_reason,omitempty" bson:"rejection_reason,omitempty"`
		IsActive          bool      `json:"is_active" bson:"is_active"`
		CreatedAt         time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt         time.Time `json:"updated_at" bson:"updated_at"`
	}

	Slot struct {
		ID              string    `json:"id" bson:"_id"`
		HallID          string    `json:"hall_id" bson:"hall_id"`
		ComplexID       string    `json:"complex_id" bson:"complex_id"`
		SportID         string    `json:"sport_id" bson:"sport_id"`
		Title           string    `json:"title,omitempty" bson:"title,omitempty"`
		StartsAt        time.Time `json:"starts_at" bson:"starts_at"`
		EndsAt          time.Time `json:"ends_at" bson:"ends_at"`
		DurationMinutes int       `json:"duration_minutes" bson:"duration_minutes"`
		BasePrice       int64     `json:"base_price" bson:"base_price"`
		FinalPrice      int64     `json:"final_price" bson:"final_price"`
		DiscountPercent int       `json:"discount_percent" bson:"discount_percent"`
		// Gender restricts this specific session to male/female; empty means it
		// inherits the hall's GenderRule default.
		Gender string `json:"gender,omitempty" bson:"gender,omitempty"`
		// BookedCount is 0 for an open session and 1 once it is booked; a session
		// holds at most one booking (no per-session capacity).
		BookedCount                int                `json:"booked_count" bson:"booked_count"`
		Status                     string             `json:"status" bson:"status"`
		PaymentPolicy              string             `json:"payment_policy" bson:"payment_policy"`
		MinDepositAmount           int64              `json:"min_deposit_amount" bson:"min_deposit_amount"`
		CancellationPolicySnapshot CancellationPolicy `json:"cancellation_policy_snapshot" bson:"cancellation_policy_snapshot"`
		Notes                      string             `json:"notes,omitempty" bson:"notes,omitempty"`
		AdminComment               string             `json:"admin_comment,omitempty" bson:"admin_comment,omitempty"`
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
		Province           string             `json:"province"`
		City               string             `json:"city" validate:"required"`
		Address            string             `json:"address" validate:"required"`
		Lat                float64            `json:"lat"`
		Lng                float64            `json:"lng"`
		ContactPhone       string             `json:"contact_phone"`
		ContactMobile      string             `json:"contact_mobile"`
		ContactLandline    string             `json:"contact_landline"`
		Images             []string           `json:"images" validate:"required,min=1"`
		Amenities          []string           `json:"amenities"`
		Rules              []string           `json:"rules"`
		CancellationPolicy CancellationPolicy `json:"cancellation_policy"`
	}

	UpdateComplexRequest struct {
		Name            string   `json:"name"`
		Description     string   `json:"description"`
		Province        string   `json:"province"`
		City            string   `json:"city"`
		Address         string   `json:"address"`
		Lat             *float64 `json:"lat"`
		Lng             *float64 `json:"lng"`
		ContactPhone    string   `json:"contact_phone"`
		ContactMobile   string   `json:"contact_mobile"`
		ContactLandline string   `json:"contact_landline"`
		Images          []string `json:"images"`
		Amenities       []string `json:"amenities"`
		Rules           []string `json:"rules"`
	}

	UpdateHallRequest struct {
		Name              string   `json:"name"`
		SupportedSportIDs []string `json:"supported_sport_ids"`
		Capacity          *int     `json:"capacity"`
		IndoorOutdoor     string   `json:"indoor_outdoor"`
		FloorType         string   `json:"floor_type"`
		Dimensions        string   `json:"dimensions"`
		Amenities         []string `json:"amenities"`
		GenderRule        string   `json:"gender_rule"`
		BasePrice         *int64   `json:"base_price"`
		Images            []string `json:"images"`
		IsActive          *bool    `json:"is_active"`
	}

	// UpdateSlotRequest is a partial edit of one session. Every field is optional
	// so the calendar can patch just a price, a drag-resized time, or an
	// operational status without resending the whole record.
	UpdateSlotRequest struct {
		Status          *string    `json:"status"`
		Title           *string    `json:"title"`
		StartsAt        *time.Time `json:"starts_at"`
		EndsAt          *time.Time `json:"ends_at"`
		BasePrice       *int64     `json:"base_price"`
		DiscountPercent *int       `json:"discount_percent"`
		Notes           *string    `json:"notes"`
		AdminComment    *string    `json:"admin_comment"`
		Gender          *string    `json:"gender"`
	}

	ComplexListItem struct {
		Complex
		LowestPrice        int64    `json:"lowest_price"`
		AvailableSlotCount int      `json:"available_slot_count"`
		DiscountPercent    int      `json:"discount_percent"`
		SportIDs           []string `json:"sport_ids"`
	}

	PaginatedComplexes struct {
		Items []ComplexListItem `json:"items"`
		Total int64             `json:"total"`
		Page  int               `json:"page"`
		Limit int               `json:"limit"`
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
		Images            []string `json:"images" validate:"required,min=1"`
	}

	CreateSlotRequest struct {
		HallID           string    `json:"hall_id" validate:"required"`
		ComplexID        string    `json:"complex_id" validate:"required"`
		SportID          string    `json:"sport_id" validate:"required"`
		Title            string    `json:"title"`
		StartsAt         time.Time `json:"starts_at" validate:"required"`
		EndsAt           time.Time `json:"ends_at" validate:"required"`
		BasePrice        int64     `json:"base_price" validate:"required"`
		DiscountPercent  int       `json:"discount_percent"`
		PaymentPolicy    string    `json:"payment_policy"`
		MinDepositAmount int64     `json:"min_deposit_amount"`
		Status           string    `json:"status"`
		Notes            string    `json:"notes"`
		Gender           string    `json:"gender"`
	}

	// ---- Session management (calendar) ------------------------------------

	// GenerateSessionsRequest creates many sessions at once over a date range
	// for selected weekdays — the recurring/bulk scheduling tool. Peak pricing
	// and exception (holiday) dates are optional.
	GenerateSessionsRequest struct {
		HallID          string   `json:"hall_id" validate:"required"`
		SportID         string   `json:"sport_id" validate:"required"`
		StartDate       string   `json:"start_date" validate:"required"` // YYYY-MM-DD (local)
		EndDate         string   `json:"end_date" validate:"required"`
		Weekdays        []int    `json:"weekdays" validate:"required"`  // 0=Sunday..6=Saturday (Go time.Weekday)
		DayStart        string   `json:"day_start" validate:"required"` // HH:MM
		DayEnd          string   `json:"day_end" validate:"required"`   // HH:MM
		SlotMinutes     int      `json:"slot_minutes" validate:"required"`
		GapMinutes      int      `json:"gap_minutes"` // minutes of rest between consecutive sessions
		BasePrice       int64    `json:"base_price" validate:"required"`
		DiscountPercent int      `json:"discount_percent"`
		PaymentPolicy   string   `json:"payment_policy"`
		PeakStart       string   `json:"peak_start"` // HH:MM (optional)
		PeakEnd         string   `json:"peak_end"`
		PeakPrice       int64    `json:"peak_price"`
		ExceptionDates  []string `json:"exception_dates"` // YYYY-MM-DD to skip (holidays)
		Gender          string   `json:"gender"`
	}

	CopyDayRequest struct {
		HallID   string   `json:"hall_id" validate:"required"`
		FromDate string   `json:"from_date" validate:"required"`
		ToDates  []string `json:"to_dates" validate:"required"`
	}

	DuplicateWeekRequest struct {
		HallID        string `json:"hall_id" validate:"required"`
		FromWeekStart string `json:"from_week_start" validate:"required"` // YYYY-MM-DD
		Weeks         int    `json:"weeks" validate:"required"`
	}

	BulkUpdateSessionsRequest struct {
		SlotIDs         []string `json:"slot_ids" validate:"required"`
		Status          *string  `json:"status"`
		BasePrice       *int64   `json:"base_price"`
		DiscountPercent *int     `json:"discount_percent"`
		Gender          *string  `json:"gender"`
	}

	BlockRangeRequest struct {
		HallID string    `json:"hall_id" validate:"required"`
		From   time.Time `json:"from" validate:"required"`
		To     time.Time `json:"to" validate:"required"`
		Status string    `json:"status"` // closed | maintenance | holiday | special_event
		Reason string    `json:"reason"`
	}

	BulkResult struct {
		Created int    `json:"created"`
		Updated int    `json:"updated"`
		Skipped int    `json:"skipped"`
		Message string `json:"message"`
	}

	// SessionView enriches a Slot with derived occupancy and revenue for the
	// owner calendar.
	SessionView struct {
		Slot
		Fill            string `json:"fill"` // available | partial | full
		RemainingSpots  int    `json:"remaining_spots"`
		RevenueEstimate int64  `json:"revenue_estimate"`
		AlmostFull      bool   `json:"almost_full"`
		LowDemand       bool   `json:"low_demand"`
	}

	MapVenue struct {
		ID                 string       `json:"id" bson:"_id"`
		Name               string       `json:"name" bson:"name"`
		City               string       `json:"city" bson:"city"`
		Location           GeoJSONPoint `json:"location" bson:"location"`
		RatingAvg          float64      `json:"rating_avg" bson:"rating_avg"`
		LowestPrice        int64        `json:"lowest_price" bson:"lowest_price"`
		DiscountPercent    int          `json:"discount_percent" bson:"discount_percent"`
		AvailableSlotCount int          `json:"available_slot_count" bson:"available_slot_count"`
		NearestSlotAt      *time.Time   `json:"nearest_slot_at,omitempty" bson:"nearest_slot_at,omitempty"`
		DistanceMeters     float64      `json:"distance_meters,omitempty" bson:"distance_meters,omitempty"`
	}
)
