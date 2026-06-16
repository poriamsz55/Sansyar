package location

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
)

type Service struct {
	provinces *database.Repository[Province]
}

func NewService(provinces *database.Repository[Province]) *Service {
	return &Service{provinces: provinces}
}

func (s *Service) list(ctx context.Context) ([]Province, error) {
	return s.provinces.FindAll(ctx, bson.M{}, database.Page{Limit: 100, Sort: bson.D{{Key: "order", Value: 1}}})
}
