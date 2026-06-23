package venue

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"sansyar/backend/internal/auth"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/rbac"
	"sansyar/backend/pkg/validator"
)

// sanitizeContacts normalizes optional mobile/landline contact numbers to a
// canonical form (Iranian mobile as 09XXXXXXXXX, landline with leading-0 area
// code). Empty values pass through; non-empty invalid values are rejected.
func sanitizeContacts(mobile, landline string) (string, string, error) {
	m, ok := validator.NormalizeIranMobile(mobile)
	if !ok {
		return "", "", fmt.Errorf("%w: شماره موبایل نامعتبر است", errormap.ErrInvalidInput)
	}
	l, ok := validator.NormalizeIranLandline(landline)
	if !ok {
		return "", "", fmt.Errorf("%w: شماره تلفن ثابت نامعتبر است", errormap.ErrInvalidInput)
	}
	return m, l, nil
}

// legacyContactPhone is the value kept in the legacy contact_phone field used by
// public pages: the landline is preferred (the venue's main line), then the
// mobile, then any pre-existing value.
func legacyContactPhone(mobile, landline, fallback string) string {
	if landline != "" {
		return landline
	}
	if mobile != "" {
		return mobile
	}
	return fallback
}

// isReserved reports whether a session already carries a booking and so must be
// locked from time changes (move / resize / reschedule).
func isReserved(slot Slot) bool {
	return slot.BookedCount > 0 || slot.Status == SlotReserved || slot.BookingID != ""
}

// hallModerated reports whether a hall has already been through moderation
// (approved, published, or rejected) and so a meaningful content edit must
// re-enter the approval queue before it can become live.
func hallModerated(status string) bool {
	return status == HallApproved || status == HallPublished || status == HallRejected
}

type Service struct {
	complexes *database.Repository[Complex]
	halls     *database.Repository[Hall]
	slots     *database.Repository[Slot]
	audits    *database.Repository[ScheduleAudit]
}

func NewService(complexes *database.Repository[Complex], halls *database.Repository[Hall], slots *database.Repository[Slot], audits *database.Repository[ScheduleAudit]) *Service {
	return &Service{complexes: complexes, halls: halls, slots: slots, audits: audits}
}

type listComplexParams struct {
	City        string
	Status      string
	Query       string
	Page        int
	Limit       int
	OwnerID     string
	AllStatuses bool
}

func (s *Service) listComplexesPaginated(ctx context.Context, params listComplexParams) (PaginatedComplexes, error) {
	filter := bson.M{}
	if params.City != "" {
		filter["city"] = params.City
	}
	if params.OwnerID != "" {
		filter["owner_id"] = params.OwnerID
	}
	if params.Status != "" {
		filter["status"] = params.Status
	} else if !params.AllStatuses {
		filter["status"] = ComplexPublished
	}
	if params.Query != "" {
		re := regexp.QuoteMeta(params.Query)
		filter["$or"] = bson.A{
			bson.M{"name": bson.M{"$regex": re, "$options": "i"}},
			bson.M{"city": bson.M{"$regex": re, "$options": "i"}},
			bson.M{"address": bson.M{"$regex": re, "$options": "i"}},
		}
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	page := params.Page
	if page <= 0 {
		page = 1
	}
	offset := int64((page - 1) * limit)

	total, err := s.complexes.Count(ctx, filter)
	if err != nil {
		return PaginatedComplexes{}, err
	}

	items, err := s.complexes.FindAll(ctx, filter, database.Page{
		Limit:  int64(limit),
		Offset: offset,
		Sort:   bson.D{{Key: "rating_avg", Value: -1}},
	})
	if err != nil {
		return PaginatedComplexes{}, err
	}

	enriched := make([]ComplexListItem, 0, len(items))
	for _, item := range items {
		summary, err := s.summarizeComplex(ctx, item)
		if err != nil {
			return PaginatedComplexes{}, err
		}
		enriched = append(enriched, summary)
	}

	return PaginatedComplexes{
		Items: enriched,
		Total: total,
		Page:  page,
		Limit: limit,
	}, nil
}

func hallIsPublic(h Hall) bool {
	if !h.IsActive {
		return false
	}
	status := h.Status
	if status == "" {
		return true
	}
	return status == HallApproved || status == HallPublished
}

func complexIsPublic(c Complex) bool {
	return c.Status == ComplexPublished
}

// complexModerated reports whether the complex has passed super admin
// moderation at least once. Such complexes can never be hard-deleted — only
// deactivated — so paid bookings and reviews keep a valid reference.
func complexModerated(status string) bool {
	return status == ComplexApproved || status == ComplexPublished || status == ComplexSuspended
}

// complexLive reports whether the complex is currently approved content.
// Edits to live complexes are staged as pending changes that require
// re-approval instead of going live immediately.
func complexLive(status string) bool {
	return status == ComplexApproved || status == ComplexPublished
}

func (s *Service) assertComplexOwner(ctx context.Context, complexID, ownerID string) error {
	complex, err := s.getComplex(ctx, complexID)
	if err != nil {
		return err
	}
	return rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID)
}

func (s *Service) ComplexIDsForOwner(ctx context.Context, ownerID string) ([]string, error) {
	return s.complexIDsForOwner(ctx, ownerID)
}

func (s *Service) complexIDsForOwner(ctx context.Context, ownerID string) ([]string, error) {
	items, err := s.complexes.FindAll(ctx, bson.M{"owner_id": ownerID}, database.Page{Limit: 500})
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	return ids, nil
}

func (s *Service) summarizeComplex(ctx context.Context, item Complex) (ComplexListItem, error) {
	summary := ComplexListItem{Complex: item}

	hallItems, err := s.halls.FindAll(ctx, bson.M{"complex_id": item.ID, "is_active": true}, database.Page{Limit: 100})
	if err != nil {
		return summary, err
	}

	sportSet := map[string]struct{}{}
	var lowest int64
	for _, hall := range hallItems {
		if !hallIsPublic(hall) {
			continue
		}
		for _, sid := range hall.SupportedSportIDs {
			sportSet[sid] = struct{}{}
		}
		if hall.BasePrice > 0 && (lowest == 0 || hall.BasePrice < lowest) {
			lowest = hall.BasePrice
		}
	}
	for sid := range sportSet {
		summary.SportIDs = append(summary.SportIDs, sid)
	}
	summary.LowestPrice = lowest

	now := time.Now().UTC()
	slotFilter := bson.M{
		"complex_id": item.ID,
		"status":     SlotAvailable,
		"starts_at":  bson.M{"$gte": now},
		// A session counts as available only while it holds no booking.
		"booked_count": bson.M{"$lt": 1},
	}
	slots, err := s.slots.FindAll(ctx, slotFilter, database.Page{Limit: 500})
	if err != nil {
		return summary, err
	}
	summary.AvailableSlotCount = len(slots)
	for _, slot := range slots {
		if slot.DiscountPercent > summary.DiscountPercent {
			summary.DiscountPercent = slot.DiscountPercent
		}
		if slot.FinalPrice > 0 && (summary.LowestPrice == 0 || slot.FinalPrice < summary.LowestPrice) {
			summary.LowestPrice = slot.FinalPrice
		}
	}

	return summary, nil
}

func (s *Service) getComplex(ctx context.Context, id string) (Complex, error) {
	item, err := s.complexes.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Complex{}, errormap.ErrNotFound
	}
	return item, err
}

func (s *Service) getComplexSummary(ctx context.Context, id string) (ComplexListItem, error) {
	item, err := s.getComplex(ctx, id)
	if err != nil {
		return ComplexListItem{}, err
	}
	return s.summarizeComplex(ctx, item)
}

func defaultCoordinates(lat, lng float64) (float64, float64) {
	if lat == 0 && lng == 0 {
		return 35.6892, 51.3890
	}
	return lat, lng
}

func (s *Service) createComplex(ctx context.Context, ownerID string, req CreateComplexRequest) (Complex, error) {
	now := time.Now().UTC()
	lat, lng := defaultCoordinates(req.Lat, req.Lng)
	mobile, landline, err := sanitizeContacts(req.ContactMobile, req.ContactLandline)
	if err != nil {
		return Complex{}, err
	}
	item := Complex{
		ID:                 uuid.NewString(),
		OwnerID:            ownerID,
		Name:               req.Name,
		Slug:               req.Slug,
		Description:        req.Description,
		Province:           req.Province,
		City:               req.City,
		Address:            req.Address,
		Location:           GeoJSONPoint{Type: "Point", Coordinates: []float64{lng, lat}},
		ContactPhone:       legacyContactPhone(mobile, landline, req.ContactPhone),
		ContactMobile:      mobile,
		ContactLandline:    landline,
		Images:             req.Images,
		Amenities:          req.Amenities,
		Rules:              req.Rules,
		CancellationPolicy: req.CancellationPolicy,
		Status:             ComplexPendingApproval,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if item.Images == nil {
		item.Images = []string{}
	}
	if item.Amenities == nil {
		item.Amenities = []string{}
	}
	if item.Rules == nil {
		item.Rules = []string{}
	}
	if item.CancellationPolicy.FreeBeforeHours == 0 {
		item.CancellationPolicy = CancellationPolicy{FreeBeforeHours: 24, PartialBeforeHours: 6, PartialRefundPct: 50}
	}
	if err := s.complexes.Create(ctx, item); err != nil {
		return Complex{}, err
	}
	return item, nil
}

func (s *Service) updateComplex(ctx context.Context, ownerID string, id string, req UpdateComplexRequest) (Complex, error) {
	item, err := s.complexes.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Complex{}, errormap.ErrNotFound
	}
	if err != nil {
		return Complex{}, err
	}
	if !rbac.IsSuperAdmin(ctx) && item.OwnerID != ownerID {
		return Complex{}, errormap.ErrForbidden
	}

	now := time.Now().UTC()

	mobile, landline, err := sanitizeContacts(req.ContactMobile, req.ContactLandline)
	if err != nil {
		return Complex{}, err
	}

	// Live complexes keep serving their approved data: the edit is staged as
	// pending changes and only goes live once a super admin re-approves it.
	if complexLive(item.Status) {
		changes := ComplexChanges{
			Name:            req.Name,
			Description:     req.Description,
			Province:        req.Province,
			City:            req.City,
			Address:         req.Address,
			ContactPhone:    legacyContactPhone(mobile, landline, req.ContactPhone),
			ContactMobile:   mobile,
			ContactLandline: landline,
			Images:          req.Images,
			Amenities:       req.Amenities,
			Rules:           req.Rules,
			SubmittedAt:     now,
		}
		if req.Lat != nil && req.Lng != nil {
			changes.Location = &GeoJSONPoint{Type: "Point", Coordinates: []float64{*req.Lng, *req.Lat}}
		}
		if err := s.complexes.Update(ctx, id, bson.M{"$set": bson.M{"pending_changes": changes, "updated_at": now}}); err != nil {
			return Complex{}, err
		}
		return s.complexes.FindByID(ctx, id)
	}

	update := buildComplexUpdate(req, mobile, landline, now)
	// Editing a rejected submission re-enters the review queue.
	if item.Status == ComplexRejected {
		update["status"] = ComplexPendingApproval
	}
	if err := s.complexes.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
}

func buildComplexUpdate(req UpdateComplexRequest, mobile, landline string, now time.Time) bson.M {
	update := bson.M{"updated_at": now}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Description != "" {
		update["description"] = req.Description
	}
	if req.Province != "" {
		update["province"] = req.Province
	}
	if req.City != "" {
		update["city"] = req.City
	}
	if req.Address != "" {
		update["address"] = req.Address
	}
	// The owner form sends the split mobile/landline pair; the legacy admin form
	// sends only contact_phone. Update whichever fields were provided, and never
	// blank out the others (so a legacy-only edit can't wipe the split values).
	if mobile != "" || landline != "" {
		update["contact_mobile"] = mobile
		update["contact_landline"] = landline
		update["contact_phone"] = legacyContactPhone(mobile, landline, req.ContactPhone)
	} else if req.ContactPhone != "" {
		update["contact_phone"] = req.ContactPhone
	}
	if req.Images != nil {
		update["images"] = req.Images
	}
	if req.Amenities != nil {
		update["amenities"] = req.Amenities
	}
	if req.Rules != nil {
		update["rules"] = req.Rules
	}
	if req.Lat != nil && req.Lng != nil {
		update["location"] = GeoJSONPoint{Type: "Point", Coordinates: []float64{*req.Lng, *req.Lat}}
	}
	return update
}

func (s *Service) deleteComplex(ctx context.Context, ownerID string, id string) error {
	item, err := s.complexes.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	}
	if err != nil {
		return err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, item.OwnerID, ownerID); err != nil {
		return err
	}

	// Once moderated, a complex can only be deactivated so existing bookings
	// and reviews keep a valid reference.
	if complexModerated(item.Status) {
		return s.complexes.Update(ctx, id, bson.M{"$set": bson.M{"status": ComplexSuspended, "updated_at": time.Now().UTC()}})
	}

	// Never approved: the whole submission disappears, including its halls and
	// slots. Nothing public ever referenced it.
	if _, err := s.slots.Collection().DeleteMany(ctx, bson.M{"complex_id": id}); err != nil {
		return err
	}
	if _, err := s.halls.Collection().DeleteMany(ctx, bson.M{"complex_id": id}); err != nil {
		return err
	}
	return s.complexes.Delete(ctx, id)
}

func (s *Service) approveComplex(ctx context.Context, id string, status string, reason string) (Complex, error) {
	if status != ComplexApproved && status != ComplexRejected {
		return Complex{}, fmt.Errorf("%w: invalid approval status", errormap.ErrInvalidInput)
	}
	item, err := s.getComplex(ctx, id)
	if err != nil {
		return Complex{}, err
	}

	now := time.Now().UTC()

	// A live complex with staged changes: approving applies them, rejecting
	// discards them — either way the complex keeps its current live status.
	if item.PendingChanges != nil && complexLive(item.Status) {
		update := bson.M{
			"$unset": bson.M{"pending_changes": ""},
			"$set":   bson.M{"updated_at": now},
		}
		if status == ComplexApproved {
			update["$set"] = applyComplexChanges(item.PendingChanges, now)
		}
		if err := s.complexes.Update(ctx, id, update); err != nil {
			return Complex{}, err
		}
		return s.complexes.FindByID(ctx, id)
	}

	set := bson.M{"status": status, "updated_at": now}
	update := bson.M{"$set": set}
	if status == ComplexRejected {
		set["rejection_reason"] = reason
	} else {
		// Approval clears any prior rejection note.
		update["$unset"] = bson.M{"rejection_reason": ""}
	}
	if err := s.complexes.Update(ctx, id, update); err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
}

// applyComplexChanges converts staged changes into a $set document for the
// live fields.
func applyComplexChanges(ch *ComplexChanges, now time.Time) bson.M {
	set := bson.M{"updated_at": now}
	if ch.Name != "" {
		set["name"] = ch.Name
	}
	if ch.Description != "" {
		set["description"] = ch.Description
	}
	if ch.Province != "" {
		set["province"] = ch.Province
	}
	if ch.City != "" {
		set["city"] = ch.City
	}
	if ch.Address != "" {
		set["address"] = ch.Address
	}
	if ch.ContactPhone != "" {
		set["contact_phone"] = ch.ContactPhone
	}
	if ch.ContactMobile != "" {
		set["contact_mobile"] = ch.ContactMobile
	}
	if ch.ContactLandline != "" {
		set["contact_landline"] = ch.ContactLandline
	}
	if ch.Images != nil {
		set["images"] = ch.Images
	}
	if ch.Amenities != nil {
		set["amenities"] = ch.Amenities
	}
	if ch.Rules != nil {
		set["rules"] = ch.Rules
	}
	if ch.Location != nil {
		set["location"] = *ch.Location
	}
	return set
}

func (s *Service) listHalls(ctx context.Context, complexID string, activeOnly bool, approvedOnly bool) ([]Hall, error) {
	filter := bson.M{"complex_id": complexID}
	if activeOnly {
		filter["is_active"] = true
	}
	items, err := s.halls.FindAll(ctx, filter, database.Page{Limit: 100, Sort: bson.D{{Key: "name", Value: 1}}})
	if err != nil {
		return nil, err
	}
	if !approvedOnly {
		return items, nil
	}
	filtered := make([]Hall, 0, len(items))
	for _, item := range items {
		if hallIsPublic(item) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *Service) listAllHalls(ctx context.Context, status string) ([]Hall, error) {
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	return s.halls.FindAll(ctx, filter, database.Page{Limit: 500, Sort: bson.D{{Key: "created_at", Value: -1}}})
}

func (s *Service) getHall(ctx context.Context, id string) (Hall, error) {
	item, err := s.halls.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Hall{}, errormap.ErrNotFound
	}
	return item, err
}

func (s *Service) createHall(ctx context.Context, ownerID string, complexID string, req CreateHallRequest) (Hall, error) {
	complex, err := s.getComplex(ctx, complexID)
	if err != nil {
		return Hall{}, err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return Hall{}, err
	}
	now := time.Now().UTC()
	item := Hall{
		ID:                uuid.NewString(),
		ComplexID:         complexID,
		Name:              req.Name,
		SupportedSportIDs: req.SupportedSportIDs,
		Capacity:          req.Capacity,
		IndoorOutdoor:     req.IndoorOutdoor,
		FloorType:         req.FloorType,
		Dimensions:        req.Dimensions,
		Amenities:         req.Amenities,
		GenderRule:        req.GenderRule,
		BasePrice:         req.BasePrice,
		Images:            req.Images,
		Status:            HallPendingApproval,
		IsActive:          true,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if item.Images == nil {
		item.Images = []string{}
	}
	if item.Amenities == nil {
		item.Amenities = []string{}
	}
	if err := s.halls.Create(ctx, item); err != nil {
		return Hall{}, err
	}
	return item, nil
}

func (s *Service) updateHall(ctx context.Context, ownerID string, id string, req UpdateHallRequest) (Hall, error) {
	item, err := s.halls.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Hall{}, errormap.ErrNotFound
	}
	if err != nil {
		return Hall{}, err
	}
	complex, err := s.getComplex(ctx, item.ComplexID)
	if err != nil {
		return Hall{}, err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return Hall{}, err
	}

	update := bson.M{"updated_at": time.Now().UTC()}
	// content tracks whether a moderated field changed. A purely operational
	// toggle (activate/deactivate) is not a content edit and must not re-trigger
	// moderation.
	content := false
	if req.Name != "" {
		update["name"] = req.Name
		content = true
	}
	if req.SupportedSportIDs != nil {
		update["supported_sport_ids"] = req.SupportedSportIDs
		content = true
	}
	if req.Capacity != nil {
		update["capacity"] = *req.Capacity
		content = true
	}
	if req.IndoorOutdoor != "" {
		update["indoor_outdoor"] = req.IndoorOutdoor
		content = true
	}
	if req.FloorType != "" {
		update["floor_type"] = req.FloorType
		content = true
	}
	if req.Dimensions != "" {
		update["dimensions"] = req.Dimensions
		content = true
	}
	if req.Amenities != nil {
		update["amenities"] = req.Amenities
		content = true
	}
	if req.GenderRule != "" {
		update["gender_rule"] = req.GenderRule
		content = true
	}
	if req.BasePrice != nil {
		update["base_price"] = *req.BasePrice
		content = true
	}
	if req.Images != nil {
		update["images"] = req.Images
		content = true
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}

	// A meaningful content edit to an already-moderated hall must go back through
	// approval: the change cannot become live until a super admin re-approves it.
	// Operational toggles (is_active only) keep the current status.
	if content && hallModerated(item.Status) {
		update["status"] = HallPendingApproval
		update["rejection_reason"] = ""
	}

	if err := s.halls.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Hall{}, err
	}
	return s.halls.FindByID(ctx, id)
}

func (s *Service) deleteHall(ctx context.Context, ownerID string, id string) error {
	item, err := s.halls.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	}
	if err != nil {
		return err
	}
	complex, err := s.getComplex(ctx, item.ComplexID)
	if err != nil {
		return err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return err
	}
	return s.halls.Update(ctx, id, bson.M{"$set": bson.M{"is_active": false, "updated_at": time.Now().UTC()}})
}

// deleteSlot permanently removes a session. Sessions with active bookings are
// kept (the owner should close/cancel them instead) so bookings aren't orphaned.
func (s *Service) deleteSlot(ctx context.Context, ownerID string, id string) error {
	item, err := s.slots.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	}
	if err != nil {
		return err
	}
	complex, err := s.getComplex(ctx, item.ComplexID)
	if err != nil {
		return err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return err
	}
	if item.BookedCount > 0 {
		return fmt.Errorf("%w: session has active bookings; close or cancel it instead of deleting", errormap.ErrConflict)
	}
	s.audit(ctx, ownerID, item.ComplexID, item.HallID, item.ID, "session.delete", "")
	return s.slots.Delete(ctx, id)
}

func (s *Service) createSlot(ctx context.Context, ownerID string, req CreateSlotRequest) (Slot, error) {
	complex, err := s.getComplex(ctx, req.ComplexID)
	if err != nil {
		return Slot{}, err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return Slot{}, err
	}
	if !req.EndsAt.After(req.StartsAt) {
		return Slot{}, fmt.Errorf("%w: ends_at must be after starts_at", errormap.ErrInvalidInput)
	}
	status := req.Status
	if status == "" {
		status = SlotAvailable
	}
	paymentPolicy := req.PaymentPolicy
	if paymentPolicy == "" {
		paymentPolicy = "full_online"
	}
	finalPrice := req.BasePrice - (req.BasePrice * int64(req.DiscountPercent) / 100)
	now := time.Now().UTC()
	item := Slot{
		ID:                         uuid.NewString(),
		HallID:                     req.HallID,
		ComplexID:                  req.ComplexID,
		SportID:                    req.SportID,
		Title:                      req.Title,
		StartsAt:                   req.StartsAt.UTC(),
		EndsAt:                     req.EndsAt.UTC(),
		DurationMinutes:            int(req.EndsAt.Sub(req.StartsAt).Minutes()),
		BasePrice:                  req.BasePrice,
		FinalPrice:                 finalPrice,
		DiscountPercent:            req.DiscountPercent,
		BookedCount:                0,
		Status:                     status,
		PaymentPolicy:              paymentPolicy,
		MinDepositAmount:           req.MinDepositAmount,
		CancellationPolicySnapshot: complex.CancellationPolicy,
		Notes:                      req.Notes,
		CreatedBy:                  ownerID,
		CreatedAt:                  now,
		UpdatedAt:                  now,
	}
	if err := s.slots.Create(ctx, item); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Slot{}, fmt.Errorf("%w: a session already exists at this time", errormap.ErrConflict)
		}
		return Slot{}, err
	}
	s.audit(ctx, ownerID, item.ComplexID, item.HallID, item.ID, "session.create", item.Title)
	return item, nil
}

// updateSlot applies a partial edit to one session: operational status, title,
// drag-resized times, price, discount, capacity, notes, or internal comment.
func (s *Service) updateSlot(ctx context.Context, ownerID string, id string, req UpdateSlotRequest) (Slot, error) {
	item, err := s.slots.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Slot{}, errormap.ErrNotFound
	}
	if err != nil {
		return Slot{}, err
	}
	complex, err := s.getComplex(ctx, item.ComplexID)
	if err != nil {
		return Slot{}, err
	}
	if err := rbac.RequireOwnerOrAdmin(ctx, complex.OwnerID, ownerID); err != nil {
		return Slot{}, err
	}

	now := time.Now().UTC()
	update := bson.M{"updated_at": now}

	// A booked/reserved session is locked: its time cannot be moved, resized, or
	// rescheduled by the owner, since customers already hold that exact slot.
	locked := isReserved(item)

	if req.Status != nil {
		if !isValidOperationalStatus(*req.Status) {
			return Slot{}, fmt.Errorf("%w: invalid session status", errormap.ErrInvalidInput)
		}
		update["status"] = *req.Status
	}
	if req.Title != nil {
		update["title"] = *req.Title
	}
	if req.Notes != nil {
		update["notes"] = *req.Notes
	}
	if req.AdminComment != nil {
		update["admin_comment"] = *req.AdminComment
	}

	// Time edits come from drag-to-move / drag-to-resize on the calendar.
	starts, ends := item.StartsAt, item.EndsAt
	if req.StartsAt != nil {
		starts = req.StartsAt.UTC()
	}
	if req.EndsAt != nil {
		ends = req.EndsAt.UTC()
	}
	timeChanged := (req.StartsAt != nil && !starts.Equal(item.StartsAt)) ||
		(req.EndsAt != nil && !ends.Equal(item.EndsAt))
	if timeChanged {
		if locked {
			return Slot{}, fmt.Errorf("%w: this session is reserved and its time cannot be changed", errormap.ErrConflict)
		}
		if !ends.After(starts) {
			return Slot{}, fmt.Errorf("%w: end must be after start", errormap.ErrInvalidInput)
		}
		update["starts_at"] = starts
		update["ends_at"] = ends
		update["duration_minutes"] = int(ends.Sub(starts).Minutes())
	}

	// Price/discount edits recompute the final price.
	base := item.BasePrice
	discount := item.DiscountPercent
	if req.BasePrice != nil {
		base = *req.BasePrice
	}
	if req.DiscountPercent != nil {
		discount = *req.DiscountPercent
	}
	if req.BasePrice != nil || req.DiscountPercent != nil {
		if discount < 0 || discount > 100 {
			return Slot{}, fmt.Errorf("%w: discount must be between 0 and 100", errormap.ErrInvalidInput)
		}
		update["base_price"] = base
		update["discount_percent"] = discount
		update["final_price"] = base - (base * int64(discount) / 100)
	}

	if err := s.slots.Update(ctx, id, bson.M{"$set": update}); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return Slot{}, fmt.Errorf("%w: another session already occupies this time", errormap.ErrConflict)
		}
		return Slot{}, err
	}
	s.audit(ctx, ownerID, item.ComplexID, item.HallID, item.ID, "session.update", "")
	return s.slots.FindByID(ctx, id)
}

// isValidOperationalStatus reports whether status is an owner-settable session
// state. Booking-derived states (reserved/full) and expiry are not settable.
func isValidOperationalStatus(status string) bool {
	switch status {
	case SlotAvailable, SlotBlocked, SlotClosed, SlotMaintenance, SlotHoliday, SlotSpecialEvent:
		return true
	default:
		return false
	}
}

func (s *Service) listSlots(ctx context.Context, filter bson.M) ([]Slot, error) {
	return s.slots.FindAll(ctx, filter, database.Page{Limit: 200, Sort: bson.D{{Key: "starts_at", Value: 1}}})
}

func (s *Service) mapVenues(ctx context.Context, lat float64, lng float64, radius int64, sportID string, discountOnly bool, availableOnly bool) ([]MapVenue, error) {
	if radius == 0 {
		radius = 10000
	}

	near := bson.D{
		{Key: "$geoNear", Value: bson.M{
			"near":          bson.M{"type": "Point", "coordinates": bson.A{lng, lat}},
			"distanceField": "distance_meters",
			"maxDistance":   radius,
			"spherical":     true,
			"query":         bson.M{"status": ComplexPublished},
		}},
	}

	cursor, err := s.complexes.Collection().Aggregate(ctx, bson.A{
		near,
		bson.M{"$lookup": bson.M{
			"from":         "time_slots",
			"localField":   "_id",
			"foreignField": "complex_id",
			"as":           "slots",
		}},
		bson.M{"$addFields": bson.M{
			"available_slots": bson.M{"$filter": bson.M{
				"input": "$slots",
				"as":    "slot",
				"cond": bson.M{"$and": bson.A{
					bson.M{"$eq": bson.A{"$$slot.status", SlotAvailable}},
					bson.M{"$gte": bson.A{"$$slot.starts_at", time.Now().UTC()}},
					bson.M{"$lt": bson.A{"$$slot.booked_count", 1}},
				}},
			}},
		}},
		bson.M{"$project": bson.M{
			"_id":                  1,
			"name":                 1,
			"city":                 1,
			"location":             1,
			"rating_avg":           1,
			"distance_meters":      1,
			"available_slot_count": bson.M{"$size": "$available_slots"},
			"lowest_price":         bson.M{"$ifNull": bson.A{bson.M{"$min": "$available_slots.final_price"}, 0}},
			"discount_percent":     bson.M{"$ifNull": bson.A{bson.M{"$max": "$available_slots.discount_percent"}, 0}},
			"nearest_slot_at":      bson.M{"$min": "$available_slots.starts_at"},
		}},
	}, options.Aggregate())
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []MapVenue
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	filtered := make([]MapVenue, 0, len(results))
	for _, item := range results {
		_ = sportID
		if discountOnly && item.DiscountPercent == 0 {
			continue
		}
		if availableOnly && item.AvailableSlotCount == 0 {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered, nil
}

func (s *Service) approveHall(ctx context.Context, id string, status string, reason string) (Hall, error) {
	if status != HallApproved && status != HallRejected {
		return Hall{}, fmt.Errorf("%w: invalid approval status", errormap.ErrInvalidInput)
	}
	set := bson.M{"status": status, "updated_at": time.Now().UTC()}
	update := bson.M{"$set": set}
	if status == HallRejected {
		set["rejection_reason"] = reason
	} else {
		update["$unset"] = bson.M{"rejection_reason": ""}
	}
	if err := s.halls.Update(ctx, id, update); errors.Is(err, database.ErrNotFound) {
		return Hall{}, errormap.ErrNotFound
	} else if err != nil {
		return Hall{}, err
	}
	return s.halls.FindByID(ctx, id)
}

func (s *Service) publishComplex(ctx context.Context, id string, publish bool) (Complex, error) {
	item, err := s.getComplex(ctx, id)
	if err != nil {
		return Complex{}, err
	}
	status := ComplexPublished
	if !publish {
		status = ComplexApproved
	} else if item.Status != ComplexApproved && item.Status != ComplexPublished {
		return Complex{}, fmt.Errorf("%w: only approved complexes can be published", errormap.ErrInvalidInput)
	}
	if err := s.complexes.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
}

func (s *Service) publishHall(ctx context.Context, id string, publish bool) (Hall, error) {
	item, err := s.getHall(ctx, id)
	if err != nil {
		return Hall{}, err
	}
	status := HallPublished
	if !publish {
		status = HallApproved
	} else if item.Status != HallApproved && item.Status != HallPublished {
		return Hall{}, fmt.Errorf("%w: only approved halls can be published", errormap.ErrInvalidInput)
	}
	if err := s.halls.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); err != nil {
		return Hall{}, err
	}
	return s.halls.FindByID(ctx, id)
}

func (s *Service) adminCreateComplex(ctx context.Context, ownerID string, req CreateComplexRequest) (Complex, error) {
	if ownerID == "" {
		return Complex{}, fmt.Errorf("%w: owner_id is required", errormap.ErrInvalidInput)
	}
	return s.createComplex(ctx, ownerID, req)
}

func (s *Service) ownerIDForRole(userID, role string) string {
	if role == auth.RoleSuperAdmin {
		return ""
	}
	return userID
}
