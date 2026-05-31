package venue

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"sansyar/backend/internal/auth"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/rbac"
)

type Service struct {
	complexes *database.Repository[Complex]
	halls     *database.Repository[Hall]
	slots     *database.Repository[Slot]
}

func NewService(complexes *database.Repository[Complex], halls *database.Repository[Hall], slots *database.Repository[Slot]) *Service {
	return &Service{complexes: complexes, halls: halls, slots: slots}
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
			bson.M{"neighborhood": bson.M{"$regex": re, "$options": "i"}},
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
	item := Complex{
		ID:                 uuid.NewString(),
		OwnerID:            ownerID,
		Name:               req.Name,
		Slug:               req.Slug,
		Description:        req.Description,
		City:               req.City,
		Neighborhood:       req.Neighborhood,
		Address:            req.Address,
		Location:           GeoJSONPoint{Type: "Point", Coordinates: []float64{lng, lat}},
		ContactPhone:       req.ContactPhone,
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

	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Description != "" {
		update["description"] = req.Description
	}
	if req.City != "" {
		update["city"] = req.City
	}
	if req.Neighborhood != "" {
		update["neighborhood"] = req.Neighborhood
	}
	if req.Address != "" {
		update["address"] = req.Address
	}
	if req.ContactPhone != "" {
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
	if err := s.complexes.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
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
	return s.complexes.Update(ctx, id, bson.M{"$set": bson.M{"status": ComplexSuspended, "updated_at": time.Now().UTC()}})
}

func (s *Service) approveComplex(ctx context.Context, id string, status string) (Complex, error) {
	if status != ComplexApproved && status != ComplexRejected {
		return Complex{}, fmt.Errorf("%w: invalid approval status", errormap.ErrInvalidInput)
	}
	if err := s.complexes.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); errors.Is(err, database.ErrNotFound) {
		return Complex{}, errormap.ErrNotFound
	} else if err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
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
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.SupportedSportIDs != nil {
		update["supported_sport_ids"] = req.SupportedSportIDs
	}
	if req.Capacity != nil {
		update["capacity"] = *req.Capacity
	}
	if req.IndoorOutdoor != "" {
		update["indoor_outdoor"] = req.IndoorOutdoor
	}
	if req.FloorType != "" {
		update["floor_type"] = req.FloorType
	}
	if req.Dimensions != "" {
		update["dimensions"] = req.Dimensions
	}
	if req.Amenities != nil {
		update["amenities"] = req.Amenities
	}
	if req.GenderRule != "" {
		update["gender_rule"] = req.GenderRule
	}
	if req.BasePrice != nil {
		update["base_price"] = *req.BasePrice
	}
	if req.Images != nil {
		update["images"] = req.Images
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
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
	finalPrice := req.BasePrice - (req.BasePrice * int64(req.DiscountPercent) / 100)
	now := time.Now().UTC()
	item := Slot{
		ID:                         uuid.NewString(),
		HallID:                     req.HallID,
		ComplexID:                  req.ComplexID,
		SportID:                    req.SportID,
		StartsAt:                   req.StartsAt.UTC(),
		EndsAt:                     req.EndsAt.UTC(),
		DurationMinutes:            int(req.EndsAt.Sub(req.StartsAt).Minutes()),
		BasePrice:                  req.BasePrice,
		FinalPrice:                 finalPrice,
		DiscountPercent:            req.DiscountPercent,
		Status:                     status,
		PaymentPolicy:              req.PaymentPolicy,
		MinDepositAmount:           req.MinDepositAmount,
		CancellationPolicySnapshot: complex.CancellationPolicy,
		CreatedBy:                  ownerID,
		CreatedAt:                  now,
		UpdatedAt:                  now,
	}
	if err := s.slots.Create(ctx, item); err != nil {
		return Slot{}, err
	}
	return item, nil
}

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
	validStatuses := map[string]struct{}{
		SlotAvailable: {}, SlotBlocked: {}, SlotMaintenance: {},
	}
	if _, ok := validStatuses[req.Status]; !ok {
		return Slot{}, fmt.Errorf("%w: invalid slot status", errormap.ErrInvalidInput)
	}
	if err := s.slots.Update(ctx, id, bson.M{"$set": bson.M{"status": req.Status, "updated_at": time.Now().UTC()}}); err != nil {
		return Slot{}, err
	}
	return s.slots.FindByID(ctx, id)
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
				}},
			}},
		}},
		bson.M{"$project": bson.M{
			"_id":                  1,
			"name":                 1,
			"city":                 1,
			"neighborhood":         1,
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

func (s *Service) approveHall(ctx context.Context, id string, status string) (Hall, error) {
	if status != HallApproved && status != HallRejected {
		return Hall{}, fmt.Errorf("%w: invalid approval status", errormap.ErrInvalidInput)
	}
	if err := s.halls.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); errors.Is(err, database.ErrNotFound) {
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
