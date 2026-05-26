package venue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

type Service struct {
	complexes *database.Repository[Complex]
	halls     *database.Repository[Hall]
	slots     *database.Repository[Slot]
}

func NewService(complexes *database.Repository[Complex], halls *database.Repository[Hall], slots *database.Repository[Slot]) *Service {
	return &Service{complexes: complexes, halls: halls, slots: slots}
}

func (s *Service) listComplexes(ctx context.Context, city string, status string) ([]Complex, error) {
	filter := bson.M{}
	if city != "" {
		filter["city"] = city
	}
	if status != "" {
		filter["status"] = status
	} else {
		filter["status"] = ComplexApproved
	}
	return s.complexes.FindAll(ctx, filter, database.Page{Limit: 50, Sort: bson.D{{Key: "rating_avg", Value: -1}}})
}

func (s *Service) getComplex(ctx context.Context, id string) (Complex, error) {
	item, err := s.complexes.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Complex{}, errormap.ErrNotFound
	}
	return item, err
}

func (s *Service) createComplex(ctx context.Context, ownerID string, req CreateComplexRequest) (Complex, error) {
	now := time.Now().UTC()
	item := Complex{
		ID:                 uuid.NewString(),
		OwnerID:            ownerID,
		Name:               req.Name,
		Slug:               req.Slug,
		Description:        req.Description,
		City:               req.City,
		Neighborhood:       req.Neighborhood,
		Address:            req.Address,
		Location:           GeoJSONPoint{Type: "Point", Coordinates: []float64{req.Lng, req.Lat}},
		ContactPhone:       req.ContactPhone,
		Images:             req.Images,
		Amenities:          req.Amenities,
		Rules:              req.Rules,
		CancellationPolicy: req.CancellationPolicy,
		Status:             ComplexPendingApproval,
		CreatedAt:          now,
		UpdatedAt:          now,
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
	if item.OwnerID != ownerID {
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
	if err := s.complexes.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return Complex{}, err
	}
	return s.complexes.FindByID(ctx, id)
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

func (s *Service) listHalls(ctx context.Context, complexID string) ([]Hall, error) {
	return s.halls.FindAll(ctx, bson.M{"complex_id": complexID, "is_active": true}, database.Page{Limit: 100, Sort: bson.D{{Key: "name", Value: 1}}})
}

func (s *Service) createHall(ctx context.Context, ownerID string, complexID string, req CreateHallRequest) (Hall, error) {
	complex, err := s.getComplex(ctx, complexID)
	if err != nil {
		return Hall{}, err
	}
	if complex.OwnerID != ownerID {
		return Hall{}, errormap.ErrForbidden
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
		IsActive:          true,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	if err := s.halls.Create(ctx, item); err != nil {
		return Hall{}, err
	}
	return item, nil
}

func (s *Service) createSlot(ctx context.Context, ownerID string, req CreateSlotRequest) (Slot, error) {
	complex, err := s.getComplex(ctx, req.ComplexID)
	if err != nil {
		return Slot{}, err
	}
	if complex.OwnerID != ownerID {
		return Slot{}, errormap.ErrForbidden
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
			"query":         bson.M{"status": ComplexApproved},
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
		if sportID != "" {
			// Detailed sport filtering is supported on the slot listing endpoint; this keeps map pins fast for MVP.
		}
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
