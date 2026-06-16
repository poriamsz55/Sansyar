package venue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/rbac"
)

// maxGeneratedSessions caps a single recurring-generate call so a wide date
// range with many daily windows cannot balloon the collection.
const maxGeneratedSessions = 2000

// iranLocation returns Asia/Tehran, falling back to a fixed +03:30 offset when
// the host has no tz database. Owner-entered wall-clock times are interpreted in
// this zone and stored as UTC, matching the browser-built ISO times.
func iranLocation() *time.Location {
	if loc, err := time.LoadLocation("Asia/Tehran"); err == nil {
		return loc
	}
	return time.FixedZone("IRST", 3*3600+30*60)
}

// hallOwnerComplex fetches the hall's complex and asserts the caller owns it (or
// is a super admin).
func (s *Service) hallOwnerComplex(ctx context.Context, hallID, ownerID string) (Hall, Complex, error) {
	hall, err := s.getHall(ctx, hallID)
	if err != nil {
		return Hall{}, Complex{}, err
	}
	complex, err := s.getComplex(ctx, hall.ComplexID)
	if err != nil {
		return Hall{}, Complex{}, err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return Hall{}, Complex{}, err
	}
	return hall, complex, nil
}

func enrichSession(slot Slot) SessionView {
	capacity := slot.Capacity
	if capacity <= 0 {
		capacity = 1
	}
	remaining := capacity - slot.BookedCount
	if remaining < 0 {
		remaining = 0
	}
	fill := "available"
	if slot.BookedCount >= capacity {
		fill = "full"
	} else if slot.BookedCount > 0 {
		fill = "partial"
	}
	view := SessionView{
		Slot:            slot,
		Fill:            fill,
		RemainingSpots:  remaining,
		RevenueEstimate: int64(slot.BookedCount) * slot.FinalPrice,
		AlmostFull:      slot.BookedCount > 0 && remaining > 0 && float64(slot.BookedCount)/float64(capacity) >= 0.8,
		LowDemand:       slot.BookedCount == 0 && slot.Status == SlotAvailable && slot.StartsAt.After(time.Now().UTC()),
	}
	return view
}

// listSessions returns owner-scoped sessions in a time range, enriched with
// occupancy and revenue for the calendar.
func (s *Service) listSessions(ctx context.Context, ownerID, hallID, complexID string, from, to time.Time) ([]SessionView, error) {
	filter := bson.M{}
	if hallID != "" {
		if _, _, err := s.hallOwnerComplex(ctx, hallID, ownerID); err != nil {
			return nil, err
		}
		filter["hall_id"] = hallID
	} else {
		ids, err := s.complexIDsForOwner(ctx, ownerID)
		if err != nil {
			return nil, err
		}
		if complexID != "" {
			if err := s.assertComplexOwner(ctx, complexID, ownerID); err != nil {
				return nil, err
			}
			filter["complex_id"] = complexID
		} else {
			filter["complex_id"] = bson.M{"$in": ids}
		}
	}
	if !from.IsZero() || !to.IsZero() {
		rng := bson.M{}
		if !from.IsZero() {
			rng["$gte"] = from
		}
		if !to.IsZero() {
			rng["$lt"] = to
		}
		filter["starts_at"] = rng
	}

	slots, err := s.slots.FindAll(ctx, filter, database.Page{Limit: 2000, Sort: bson.D{{Key: "starts_at", Value: 1}}})
	if err != nil {
		return nil, err
	}
	views := make([]SessionView, 0, len(slots))
	for _, slot := range slots {
		views = append(views, enrichSession(slot))
	}
	return views, nil
}

// generateSessions creates recurring sessions across a date range for the chosen
// weekdays, honoring peak-hour pricing and exception (holiday) dates. Existing
// clashing times are skipped via the unique hall/time index.
func (s *Service) generateSessions(ctx context.Context, ownerID string, req GenerateSessionsRequest) (BulkResult, error) {
	hall, complex, err := s.hallOwnerComplex(ctx, req.HallID, ownerID)
	if err != nil {
		return BulkResult{}, err
	}
	loc := iranLocation()

	startDate, err := time.ParseInLocation("2006-01-02", req.StartDate, loc)
	if err != nil {
		return BulkResult{}, fmt.Errorf("%w: start_date must be YYYY-MM-DD", errormap.ErrInvalidInput)
	}
	endDate, err := time.ParseInLocation("2006-01-02", req.EndDate, loc)
	if err != nil {
		return BulkResult{}, fmt.Errorf("%w: end_date must be YYYY-MM-DD", errormap.ErrInvalidInput)
	}
	if endDate.Before(startDate) {
		return BulkResult{}, fmt.Errorf("%w: end_date must not precede start_date", errormap.ErrInvalidInput)
	}
	dayStart, err := parseClock(req.DayStart)
	if err != nil {
		return BulkResult{}, err
	}
	dayEnd, err := parseClock(req.DayEnd)
	if err != nil {
		return BulkResult{}, err
	}
	if dayEnd <= dayStart {
		return BulkResult{}, fmt.Errorf("%w: day_end must be after day_start", errormap.ErrInvalidInput)
	}
	if req.SlotMinutes <= 0 {
		return BulkResult{}, fmt.Errorf("%w: slot_minutes must be positive", errormap.ErrInvalidInput)
	}
	step := req.SlotMinutes + req.GapMinutes

	weekdaySet := map[time.Weekday]bool{}
	for _, w := range req.Weekdays {
		weekdaySet[time.Weekday(((w%7)+7)%7)] = true
	}
	exceptions := map[string]bool{}
	for _, d := range req.ExceptionDates {
		exceptions[d] = true
	}
	peakStart, peakEnd := -1, -1
	if req.PeakStart != "" && req.PeakEnd != "" {
		if peakStart, err = parseClock(req.PeakStart); err != nil {
			return BulkResult{}, err
		}
		if peakEnd, err = parseClock(req.PeakEnd); err != nil {
			return BulkResult{}, err
		}
	}

	capacity := req.Capacity
	if capacity <= 0 {
		capacity = 1
	}
	paymentPolicy := req.PaymentPolicy
	if paymentPolicy == "" {
		paymentPolicy = "full_online"
	}

	now := time.Now().UTC()
	created, skipped := 0, 0
	for day := startDate; !day.After(endDate); day = day.AddDate(0, 0, 1) {
		if !weekdaySet[day.Weekday()] {
			continue
		}
		if exceptions[day.Format("2006-01-02")] {
			continue
		}
		for mins := dayStart; mins+req.SlotMinutes <= dayEnd; mins += step {
			if created >= maxGeneratedSessions {
				return BulkResult{Created: created, Skipped: skipped, Message: "reached the generation limit"}, nil
			}
			startLocal := time.Date(day.Year(), day.Month(), day.Day(), mins/60, mins%60, 0, 0, loc)
			endLocal := startLocal.Add(time.Duration(req.SlotMinutes) * time.Minute)

			price := req.BasePrice
			if peakStart >= 0 && req.PeakPrice > 0 && mins >= peakStart && mins < peakEnd {
				price = req.PeakPrice
			}
			final := price - (price * int64(req.DiscountPercent) / 100)

			slot := Slot{
				ID:                         uuid.NewString(),
				HallID:                     hall.ID,
				ComplexID:                  complex.ID,
				SportID:                    req.SportID,
				StartsAt:                   startLocal.UTC(),
				EndsAt:                     endLocal.UTC(),
				DurationMinutes:            req.SlotMinutes,
				BasePrice:                  price,
				FinalPrice:                 final,
				DiscountPercent:            req.DiscountPercent,
				Capacity:                   capacity,
				Status:                     SlotAvailable,
				PaymentPolicy:              paymentPolicy,
				CancellationPolicySnapshot: complex.CancellationPolicy,
				CreatedBy:                  ownerID,
				CreatedAt:                  now,
				UpdatedAt:                  now,
			}
			if err := s.slots.Create(ctx, slot); err != nil {
				if isDuplicate(err) {
					skipped++
					continue
				}
				return BulkResult{}, err
			}
			created++
		}
	}
	s.audit(ctx, ownerID, complex.ID, hall.ID, "", "session.generate", fmt.Sprintf("created %d, skipped %d", created, skipped))
	return BulkResult{Created: created, Skipped: skipped, Message: "sessions generated"}, nil
}

// copyDay clones every session of one day to one or more target days, preserving
// wall-clock times and pricing.
func (s *Service) copyDay(ctx context.Context, ownerID string, req CopyDayRequest) (BulkResult, error) {
	hall, complex, err := s.hallOwnerComplex(ctx, req.HallID, ownerID)
	if err != nil {
		return BulkResult{}, err
	}
	loc := iranLocation()
	from, err := time.ParseInLocation("2006-01-02", req.FromDate, loc)
	if err != nil {
		return BulkResult{}, fmt.Errorf("%w: from_date must be YYYY-MM-DD", errormap.ErrInvalidInput)
	}
	sources, err := s.sessionsOnDay(ctx, hall.ID, from, loc)
	if err != nil {
		return BulkResult{}, err
	}

	now := time.Now().UTC()
	created, skipped := 0, 0
	for _, target := range req.ToDates {
		to, err := time.ParseInLocation("2006-01-02", target, loc)
		if err != nil {
			return BulkResult{}, fmt.Errorf("%w: to_dates must be YYYY-MM-DD", errormap.ErrInvalidInput)
		}
		offset := daysBetween(from, to)
		for _, src := range sources {
			clone := src
			clone.ID = uuid.NewString()
			clone.StartsAt = src.StartsAt.AddDate(0, 0, offset)
			clone.EndsAt = src.EndsAt.AddDate(0, 0, offset)
			clone.BookedCount = 0
			clone.Status = SlotAvailable
			clone.ReservedBy = ""
			clone.BookingID = ""
			clone.CreatedBy = ownerID
			clone.CreatedAt = now
			clone.UpdatedAt = now
			if err := s.slots.Create(ctx, clone); err != nil {
				if isDuplicate(err) {
					skipped++
					continue
				}
				return BulkResult{}, err
			}
			created++
		}
	}
	s.audit(ctx, ownerID, complex.ID, hall.ID, "", "session.copy_day", fmt.Sprintf("created %d, skipped %d", created, skipped))
	return BulkResult{Created: created, Skipped: skipped, Message: "day copied"}, nil
}

// duplicateWeek repeats a week's sessions forward by N weeks.
func (s *Service) duplicateWeek(ctx context.Context, ownerID string, req DuplicateWeekRequest) (BulkResult, error) {
	hall, complex, err := s.hallOwnerComplex(ctx, req.HallID, ownerID)
	if err != nil {
		return BulkResult{}, err
	}
	if req.Weeks <= 0 || req.Weeks > 52 {
		return BulkResult{}, fmt.Errorf("%w: weeks must be between 1 and 52", errormap.ErrInvalidInput)
	}
	loc := iranLocation()
	weekStart, err := time.ParseInLocation("2006-01-02", req.FromWeekStart, loc)
	if err != nil {
		return BulkResult{}, fmt.Errorf("%w: from_week_start must be YYYY-MM-DD", errormap.ErrInvalidInput)
	}
	weekEnd := weekStart.AddDate(0, 0, 7)
	sources, err := s.slots.FindAll(ctx, bson.M{
		"hall_id":   hall.ID,
		"starts_at": bson.M{"$gte": weekStart.UTC(), "$lt": weekEnd.UTC()},
	}, database.Page{Limit: 2000, Sort: bson.D{{Key: "starts_at", Value: 1}}})
	if err != nil {
		return BulkResult{}, err
	}

	now := time.Now().UTC()
	created, skipped := 0, 0
	for w := 1; w <= req.Weeks; w++ {
		for _, src := range sources {
			clone := src
			clone.ID = uuid.NewString()
			clone.StartsAt = src.StartsAt.AddDate(0, 0, 7*w)
			clone.EndsAt = src.EndsAt.AddDate(0, 0, 7*w)
			clone.BookedCount = 0
			clone.Status = SlotAvailable
			clone.ReservedBy = ""
			clone.BookingID = ""
			clone.CreatedBy = ownerID
			clone.CreatedAt = now
			clone.UpdatedAt = now
			if err := s.slots.Create(ctx, clone); err != nil {
				if isDuplicate(err) {
					skipped++
					continue
				}
				return BulkResult{}, err
			}
			created++
		}
	}
	s.audit(ctx, ownerID, complex.ID, hall.ID, "", "session.duplicate_week", fmt.Sprintf("created %d, skipped %d", created, skipped))
	return BulkResult{Created: created, Skipped: skipped, Message: "week duplicated"}, nil
}

// bulkUpdate applies the same price/discount/capacity/status to many sessions.
func (s *Service) bulkUpdate(ctx context.Context, ownerID string, req BulkUpdateSessionsRequest) (BulkResult, error) {
	if len(req.SlotIDs) == 0 {
		return BulkResult{}, fmt.Errorf("%w: no sessions selected", errormap.ErrInvalidInput)
	}
	if req.Status != nil && !isValidOperationalStatus(*req.Status) {
		return BulkResult{}, fmt.Errorf("%w: invalid session status", errormap.ErrInvalidInput)
	}
	if req.DiscountPercent != nil && (*req.DiscountPercent < 0 || *req.DiscountPercent > 100) {
		return BulkResult{}, fmt.Errorf("%w: discount must be between 0 and 100", errormap.ErrInvalidInput)
	}

	now := time.Now().UTC()
	updated, skipped := 0, 0
	var complexID, hallID string
	for _, id := range req.SlotIDs {
		slot, err := s.slots.FindByID(ctx, id)
		if errors.Is(err, database.ErrNotFound) {
			skipped++
			continue
		}
		if err != nil {
			return BulkResult{}, err
		}
		complex, err := s.getComplex(ctx, slot.ComplexID)
		if err != nil {
			return BulkResult{}, err
		}
		if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
			return BulkResult{}, err
		}
		complexID, hallID = slot.ComplexID, slot.HallID

		set := bson.M{"updated_at": now}
		base := slot.BasePrice
		discount := slot.DiscountPercent
		if req.BasePrice != nil {
			base = *req.BasePrice
		}
		if req.DiscountPercent != nil {
			discount = *req.DiscountPercent
		}
		if req.BasePrice != nil || req.DiscountPercent != nil {
			set["base_price"] = base
			set["discount_percent"] = discount
			set["final_price"] = base - (base * int64(discount) / 100)
		}
		if req.Status != nil {
			set["status"] = *req.Status
		}
		if req.Capacity != nil {
			if *req.Capacity < slot.BookedCount || *req.Capacity < 1 {
				skipped++
				continue
			}
			set["capacity"] = *req.Capacity
		}
		if err := s.slots.Update(ctx, id, bson.M{"$set": set}); err != nil {
			return BulkResult{}, err
		}
		updated++
	}
	if updated > 0 {
		s.audit(ctx, ownerID, complexID, hallID, "", "session.bulk_update", fmt.Sprintf("updated %d", updated))
	}
	return BulkResult{Updated: updated, Skipped: skipped, Message: "sessions updated"}, nil
}

// blockRange marks every session of a hall within a time window as closed,
// under maintenance, a holiday, or a special event — used for temporary
// closures and emergency shutdowns.
func (s *Service) blockRange(ctx context.Context, ownerID string, req BlockRangeRequest) (BulkResult, error) {
	hall, complex, err := s.hallOwnerComplex(ctx, req.HallID, ownerID)
	if err != nil {
		return BulkResult{}, err
	}
	if !req.To.After(req.From) {
		return BulkResult{}, fmt.Errorf("%w: 'to' must be after 'from'", errormap.ErrInvalidInput)
	}
	status := req.Status
	if status == "" {
		status = SlotClosed
	}
	if status != SlotClosed && status != SlotMaintenance && status != SlotHoliday && status != SlotSpecialEvent {
		return BulkResult{}, fmt.Errorf("%w: invalid block status", errormap.ErrInvalidInput)
	}
	res, err := s.slots.Collection().UpdateMany(ctx,
		bson.M{"hall_id": hall.ID, "starts_at": bson.M{"$gte": req.From.UTC(), "$lt": req.To.UTC()}},
		bson.M{"$set": bson.M{"status": status, "admin_comment": req.Reason, "updated_at": time.Now().UTC()}},
	)
	if err != nil {
		return BulkResult{}, err
	}
	s.audit(ctx, ownerID, complex.ID, hall.ID, "", "session.block_range", fmt.Sprintf("%s: %s", status, req.Reason))
	return BulkResult{Updated: int(res.ModifiedCount), Message: "range blocked"}, nil
}

// sessionsOnDay returns a hall's sessions for a single local day.
func (s *Service) sessionsOnDay(ctx context.Context, hallID string, day time.Time, loc *time.Location) ([]Slot, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	end := start.AddDate(0, 0, 1)
	return s.slots.FindAll(ctx, bson.M{
		"hall_id":   hallID,
		"starts_at": bson.M{"$gte": start.UTC(), "$lt": end.UTC()},
	}, database.Page{Limit: 500, Sort: bson.D{{Key: "starts_at", Value: 1}}})
}

// parseClock converts "HH:MM" into minutes past midnight.
func parseClock(s string) (int, error) {
	t, err := time.Parse("15:04", s)
	if err != nil {
		return 0, fmt.Errorf("%w: time must be HH:MM", errormap.ErrInvalidInput)
	}
	return t.Hour()*60 + t.Minute(), nil
}

func daysBetween(from, to time.Time) int {
	return int(to.Sub(from).Hours() / 24)
}

func isDuplicate(err error) bool {
	return mongo.IsDuplicateKeyError(err)
}
