package sport

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

type Service struct {
	sports *database.Repository[Sport]
}

func NewService(sports *database.Repository[Sport]) *Service {
	return &Service{sports: sports}
}

func (s *Service) list(ctx context.Context, activeOnly bool) ([]Sport, error) {
	filter := bson.M{}
	if activeOnly {
		filter["is_active"] = true
	}
	return s.sports.FindAll(ctx, filter, database.Page{Limit: 100, Sort: bson.D{{Key: "name", Value: 1}}})
}

func (s *Service) create(ctx context.Context, req CreateSportRequest) (Sport, error) {
	now := time.Now().UTC()
	item := Sport{ID: uuid.NewString(), Name: req.Name, Slug: req.Slug, Icon: req.Icon, IsActive: true, CreatedAt: now, UpdatedAt: now}
	if err := s.sports.Create(ctx, item); err != nil {
		return Sport{}, err
	}
	return item, nil
}

func (s *Service) update(ctx context.Context, id string, req UpdateSportRequest) (Sport, error) {
	update := bson.M{"updated_at": time.Now().UTC()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Slug != "" {
		update["slug"] = req.Slug
	}
	if req.Icon != "" {
		update["icon"] = req.Icon
	}
	if req.IsActive != nil {
		update["is_active"] = *req.IsActive
	}
	if err := s.sports.Update(ctx, id, bson.M{"$set": update}); errors.Is(err, database.ErrNotFound) {
		return Sport{}, errormap.ErrNotFound
	} else if err != nil {
		return Sport{}, err
	}
	return s.sports.FindByID(ctx, id)
}

func (s *Service) delete(ctx context.Context, id string) error {
	if err := s.sports.Delete(ctx, id); errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	} else {
		return err
	}
}
