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

	// Customers authenticate via SMS OTP, not a password. There is no OTP
	// verification backend yet (sms.FakeProvider only logs), so outside
	// production we accept any code for customer logins — matching the demo
	// hint "هر کد ۴ رقمی پذیرفته می‌شود". Owner/admin accounts keep password auth.
	// TODO: verify the OTP against a stored code once a real SMS provider lands.
	if s.isOTPLogin(user) {
		// OTP login: any code is accepted in non-production.
	} else if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
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

// isOTPLogin reports whether the login should be treated as a customer OTP
// login (password skipped). Customers sign in by SMS OTP; until a real OTP
// verification backend exists, this is only allowed outside production.
func (s *Service) isOTPLogin(user User) bool {
	return user.Role == RoleCustomer && s.cfg.Env != "production"
}

func (s *Service) me(ctx context.Context, userID string) (User, error) {
	user, err := s.users.FindByID(ctx, userID)
	if errors.Is(err, database.ErrNotFound) {
		return User{}, errormap.ErrNotFound
	}
	return user, err
}

func (s *Service) listUsers(ctx context.Context, role string) ([]User, error) {
	filter := bson.M{}
	if role != "" {
		filter["role"] = role
	}
	return s.users.FindAll(ctx, filter, database.Page{Limit: 500, Sort: bson.D{{Key: "created_at", Value: -1}}})
}

func (s *Service) createUser(ctx context.Context, req CreateUserRequest) (User, error) {
	allowed := map[string]struct{}{
		RoleVenueOwner: {},
		RoleCustomer:   {},
	}
	if _, ok := allowed[req.Role]; !ok {
		return User{}, fmt.Errorf("%w: role must be venue_owner or customer", errormap.ErrInvalidInput)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}

	now := time.Now().UTC()
	user := User{
		ID:           uuid.NewString(),
		FullName:     req.FullName,
		Phone:        req.Phone,
		Email:        req.Email,
		PasswordHash: string(passwordHash),
		Role:         req.Role,
		Status:       UserStatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return User{}, fmt.Errorf("%w: phone already registered", errormap.ErrConflict)
		}
		return User{}, err
	}
	return user, nil
}

func (s *Service) updateUser(ctx context.Context, id string, req UpdateUserRequest) (User, error) {
	if _, err := s.users.FindByID(ctx, id); errors.Is(err, database.ErrNotFound) {
		return User{}, errormap.ErrNotFound
	} else if err != nil {
		return User{}, err
	}

	update := bson.M{"updated_at": time.Now().UTC()}
	if req.FullName != nil {
		update["full_name"] = *req.FullName
	}
	if req.Phone != nil {
		update["phone"] = *req.Phone
	}
	if req.Email != nil {
		update["email"] = *req.Email
	}
	if req.Status != nil {
		if *req.Status != UserStatusActive && *req.Status != UserStatusSuspended {
			return User{}, fmt.Errorf("%w: invalid status", errormap.ErrInvalidInput)
		}
		update["status"] = *req.Status
	}
	if req.Role != nil {
		if *req.Role != RoleVenueOwner && *req.Role != RoleCustomer {
			return User{}, fmt.Errorf("%w: role must be venue_owner or customer", errormap.ErrInvalidInput)
		}
		update["role"] = *req.Role
	}
	if err := s.users.Update(ctx, id, bson.M{"$set": update}); err != nil {
		return User{}, err
	}
	return s.users.FindByID(ctx, id)
}

func (s *Service) suspendUser(ctx context.Context, id string) error {
	user, err := s.users.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrNotFound
	}
	if err != nil {
		return err
	}
	if user.Role == RoleSuperAdmin {
		return errormap.ErrForbidden
	}
	return s.users.Update(ctx, id, bson.M{"$set": bson.M{"status": UserStatusSuspended, "updated_at": time.Now().UTC()}})
}
