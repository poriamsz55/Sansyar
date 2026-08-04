package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"golang.org/x/crypto/bcrypt"

	"sansyar/backend/pkg/config"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	sansyarjwt "sansyar/backend/pkg/jwt"
	"sansyar/backend/pkg/sms"
)

type Service struct {
	users  *database.Repository[User]
	otps   *database.Repository[OTPCode]
	sms    sms.OTPSender
	cfg    *config.Config
	logger *slog.Logger
}

func NewService(users *database.Repository[User], otps *database.Repository[OTPCode], smsSender sms.OTPSender, cfg *config.Config, logger *slog.Logger) *Service {
	return &Service{users: users, otps: otps, sms: smsSender, cfg: cfg, logger: logger}
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

// registerOwner is self-service signup for a Vendor Admin (venue owner). It
// rejects duplicate phone or national code with distinct, user-facing messages
// and stores only a bcrypt password hash.
func (s *Service) registerOwner(ctx context.Context, req RegisterOwnerRequest) (AuthResponse, error) {
	phone := strings.TrimSpace(req.Phone)
	nationalID := strings.TrimSpace(req.NationalID)

	if _, err := s.users.FindOne(ctx, bson.M{"phone": phone}); err == nil {
		return AuthResponse{}, fmt.Errorf("%w: this mobile number is already registered", errormap.ErrConflict)
	} else if !errors.Is(err, database.ErrNotFound) {
		return AuthResponse{}, err
	}
	if _, err := s.users.FindOne(ctx, bson.M{"national_id": nationalID}); err == nil {
		return AuthResponse{}, fmt.Errorf("%w: this national code is already registered", errormap.ErrConflict)
	} else if !errors.Is(err, database.ErrNotFound) {
		return AuthResponse{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResponse{}, err
	}

	now := time.Now().UTC()
	firstName := strings.TrimSpace(req.FirstName)
	lastName := strings.TrimSpace(req.LastName)
	user := User{
		ID:           uuid.NewString(),
		FullName:     strings.TrimSpace(firstName + " " + lastName),
		FirstName:    firstName,
		LastName:     lastName,
		NationalID:   nationalID,
		Address:      strings.TrimSpace(req.Address),
		Phone:        phone,
		PasswordHash: string(passwordHash),
		Role:         RoleVenueOwner,
		Status:       UserStatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return AuthResponse{}, fmt.Errorf("%w: mobile number or national code already registered", errormap.ErrConflict)
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
	user, err := s.users.FindOne(ctx, bson.M{"phone": strings.TrimSpace(req.Phone)})
	if errors.Is(err, database.ErrNotFound) {
		return AuthResponse{}, errormap.ErrUnauthorized
	}
	if err != nil {
		return AuthResponse{}, err
	}

	now := time.Now().UTC()
	if user.LockedUntil != nil && now.Before(*user.LockedUntil) {
		mins := int(user.LockedUntil.Sub(now).Minutes()) + 1
		return AuthResponse{}, fmt.Errorf("%w: too many failed attempts, account locked for %d minutes", errormap.ErrForbidden, mins)
	}

	// Password login is for staff/owner/admin accounts. Customers sign in via
	// SMS OTP (see requestOTP/verifyOTP).
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		s.registerFailedLogin(ctx, user, now)
		return AuthResponse{}, errormap.ErrUnauthorized
	}
	if user.Status != UserStatusActive {
		return AuthResponse{}, errormap.ErrForbidden
	}

	// Successful login clears any brute-force counters.
	if user.FailedLogins > 0 || user.LockedUntil != nil {
		_ = s.users.Update(ctx, user.ID, bson.M{"$set": bson.M{"failed_logins": 0}, "$unset": bson.M{"locked_until": ""}})
	}

	ttl := s.cfg.AccessTokenTTL
	if req.RememberMe {
		ttl = s.cfg.RememberMeTokenTTL
	}
	token, err := sansyarjwt.Issue(s.cfg.JWTSecret, ttl, user.ID, user.Role)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{AccessToken: token, TokenType: "Bearer", User: user}, nil
}

// registerFailedLogin increments the brute-force counter and locks the account
// once it crosses the configured threshold.
func (s *Service) registerFailedLogin(ctx context.Context, user User, now time.Time) {
	attempts := user.FailedLogins + 1
	set := bson.M{"failed_logins": attempts, "updated_at": now}
	if attempts >= s.cfg.LoginMaxAttempts {
		lockUntil := now.Add(s.cfg.LoginLockDuration)
		set["locked_until"] = lockUntil
		set["failed_logins"] = 0
	}
	_ = s.users.Update(ctx, user.ID, bson.M{"$set": set})
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

// updateProfile applies a self-service edit to the caller's own account. It
// never touches Phone/Status/Role — those stay admin-only.
func (s *Service) updateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (User, error) {
	if _, err := s.users.FindByID(ctx, userID); errors.Is(err, database.ErrNotFound) {
		return User{}, errormap.ErrNotFound
	} else if err != nil {
		return User{}, err
	}

	update := bson.M{"updated_at": time.Now().UTC()}
	if req.FullName != nil {
		update["full_name"] = *req.FullName
	}
	if req.Email != nil {
		update["email"] = *req.Email
	}
	if req.NationalID != nil {
		update["national_id"] = *req.NationalID
	}
	if req.Address != nil {
		update["address"] = *req.Address
	}
	if err := s.users.Update(ctx, userID, bson.M{"$set": update}); err != nil {
		return User{}, err
	}
	return s.users.FindByID(ctx, userID)
}

// tempPasswordCharset excludes visually ambiguous characters (0/O, 1/l/I) so
// an admin can read a generated password aloud or over a support ticket.
const tempPasswordCharset = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const tempPasswordDigits = "23456789"
const tempPasswordLength = 12

// generateTempPassword returns a random string satisfying IsStrongPassword
// (length >= 8, at least one letter and one digit) for one-time admin-issued
// password resets.
func generateTempPassword() (string, error) {
	buf := make([]byte, tempPasswordLength)
	for i := range buf {
		charset := tempPasswordCharset
		if i == 0 {
			charset = tempPasswordDigits // guarantee at least one digit
		}
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		buf[i] = charset[n.Int64()]
	}
	return string(buf), nil
}

// adminResetPassword generates and sets a new temporary password for a user
// (owner or customer) and returns it in plaintext exactly once — the caller
// must relay it to the user immediately, since it is never stored or
// re-exposed after this call.
func (s *Service) adminResetPassword(ctx context.Context, id string) (string, error) {
	user, err := s.users.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return "", errormap.ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if user.Role == RoleSuperAdmin {
		return "", errormap.ErrForbidden
	}
	plain, err := generateTempPassword()
	if err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	if err := s.users.Update(ctx, id, bson.M{"$set": bson.M{"password_hash": string(hash), "updated_at": time.Now().UTC()}}); err != nil {
		return "", err
	}
	return plain, nil
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
