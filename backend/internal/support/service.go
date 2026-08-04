package support

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

type Service struct {
	tickets *database.Repository[Ticket]
}

func NewService(tickets *database.Repository[Ticket]) *Service {
	return &Service{tickets: tickets}
}

func (s *Service) create(ctx context.Context, userID string, req CreateTicketRequest) (Ticket, error) {
	category := req.Category
	if category != CategoryBug {
		category = CategoryContact
	}
	now := time.Now().UTC()
	item := Ticket{
		ID:        uuid.NewString(),
		UserID:    userID,
		Category:  category,
		Name:      req.Name,
		Phone:     req.Phone,
		Subject:   req.Subject,
		Message:   req.Message,
		Status:    StatusOpen,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.tickets.Create(ctx, item); err != nil {
		return Ticket{}, err
	}
	return item, nil
}

func (s *Service) list(ctx context.Context, f TicketFilter) (PaginatedTickets, error) {
	filter := bson.M{}
	if f.Status != "" {
		filter["status"] = f.Status
	}
	if f.Category != "" {
		filter["category"] = f.Category
	}
	if f.UserID != "" {
		filter["user_id"] = f.UserID
	}

	limit := f.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 200 {
		limit = 200
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}

	total, err := s.tickets.Count(ctx, filter)
	if err != nil {
		return PaginatedTickets{}, err
	}
	items, err := s.tickets.FindAll(ctx, filter, database.Page{
		Limit:  int64(limit),
		Offset: int64((page - 1) * limit),
		Sort:   bson.D{{Key: "created_at", Value: -1}},
	})
	if err != nil {
		return PaginatedTickets{}, err
	}
	return PaginatedTickets{Items: items, Total: total, Page: page, Limit: limit}, nil
}

func (s *Service) get(ctx context.Context, id string) (Ticket, error) {
	item, err := s.tickets.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return Ticket{}, errormap.ErrNotFound
	}
	return item, err
}

func (s *Service) listForUser(ctx context.Context, userID string) ([]Ticket, error) {
	return s.tickets.FindAll(ctx, bson.M{"user_id": userID}, database.Page{Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}}})
}

func (s *Service) updateStatus(ctx context.Context, id string, status string) (Ticket, error) {
	if !isValidStatus(status) {
		return Ticket{}, fmt.Errorf("%w: invalid ticket status", errormap.ErrInvalidInput)
	}
	if err := s.tickets.Update(ctx, id, bson.M{"$set": bson.M{"status": status, "updated_at": time.Now().UTC()}}); errors.Is(err, database.ErrNotFound) {
		return Ticket{}, errormap.ErrNotFound
	} else if err != nil {
		return Ticket{}, err
	}
	return s.tickets.FindByID(ctx, id)
}

// reply records the admin's response and moves an open ticket into
// in_progress; a ticket already resolved/closed keeps its status (the admin
// changes that explicitly via updateStatus).
func (s *Service) reply(ctx context.Context, id string, replyText string) (Ticket, error) {
	item, err := s.get(ctx, id)
	if err != nil {
		return Ticket{}, err
	}
	now := time.Now().UTC()
	set := bson.M{"admin_reply": replyText, "replied_at": now, "updated_at": now}
	if item.Status == StatusOpen {
		set["status"] = StatusInProgress
	}
	if err := s.tickets.Update(ctx, id, bson.M{"$set": set}); errors.Is(err, database.ErrNotFound) {
		return Ticket{}, errormap.ErrNotFound
	} else if err != nil {
		return Ticket{}, err
	}
	return s.tickets.FindByID(ctx, id)
}
