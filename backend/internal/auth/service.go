package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"

	"sansyar/backend/pkg/config"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	sansyarjwt "sansyar/backend/pkg/jwt"
)

type Service struct {
	users  *database.Repository[User]
	cfg    *config.Config
	logger *slog.Logger
}

func NewService(users *database.Repository[User], cfg *config.Config, logger *slog.Logger) *Service {
	return &Service{users: users, cfg: cfg, logger: logger}
}

func (s *Service) register(ctx context.Context, req RegisterRequest) (AuthResponse, error) {
	role := req.Role
	if role == "" {
		role = RoleCustomer
	}
	if role != RoleCustomer && role != RoleVenueOwner {
		return AuthResponse{}, fmt.Errorf("%w: public registration only supports customer or venue_owner", errormap.ErrInvalidInput)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, err
	}

	now := time.Now().UTC()
	user := User{
		ID:           uuid.NewString(),
		FullName:     req.FullName,
		Phone:        req.Phone,
		Email:        req.Email,
		PasswordHash: string(passwordHash),
		Role:         role,
		Status:       UserStatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.users.Create(ctx, user); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return AuthResponse{}, fmt.Errorf("%w: phone already registered", errormap.ErrConflict)
		}
		return AuthResponse{}, err
	}

	token, err := sansyarjwt.Issue(s.cfg.JWTSecret, s.cfg.AccessTokenTTL, user.ID, user.Role)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{AccessToken: token, TokenType: "Bearer", User: user}, nil
}

func (s *Service) login(ctx context.Context, req LoginRequest) (AuthResponse, error) {
	user, err := s.users.FindOne(ctx, bson.M{"phone": req.Phone})
	if errors.Is(err, database.ErrNotFound) {
		return AuthResponse{}, errormap.ErrUnauthorized
	}
	if err != nil {
		return AuthResponse{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return AuthResponse{}, errormap.ErrUnauthorized
	}
	if user.Status != UserStatusActive {
		return AuthResponse{}, errormap.ErrForbidden
	}

	token, err := sansyarjwt.Issue(s.cfg.JWTSecret, s.cfg.AccessTokenTTL, user.ID, user.Role)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{AccessToken: token, TokenType: "Bearer", User: user}, nil
}

func (s *Service) me(ctx context.Context, userID string) (User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if errors.Is(err, database.ErrNotFound) {
		return User{}, errormap.ErrNotFound
	}
	return user, err
}
