package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	sansyarjwt "sansyar/backend/pkg/jwt"
	"sansyar/backend/pkg/validator"
)

// OTPCode is the active verification code for a phone number. The phone is the
// document _id so each number has at most one live code, and a TTL index on
// expires_at lets MongoDB purge stale codes automatically.
type OTPCode struct {
	Phone     string    `bson:"_id"`
	CodeHash  string    `bson:"code_hash"`
	ExpiresAt time.Time `bson:"expires_at"`
	Attempts  int       `bson:"attempts"`
	CreatedAt time.Time `bson:"created_at"`
}

type (
	OTPRequestRequest struct {
		Phone string `json:"phone" validate:"required,irmobile"`
	}

	OTPRequestResponse struct {
		Message   string `json:"message"`
		ExpiresIn int    `json:"expires_in"`
	}

	OTPVerifyRequest struct {
		Phone string `json:"phone" validate:"required,irmobile"`
		Code  string `json:"code" validate:"required"`
	}
)

func (s *Service) requestOTP(ctx context.Context, req OTPRequestRequest) (OTPRequestResponse, error) {
	phone, ok := normalizeOTPPhone(req.Phone)
	if !ok {
		return OTPRequestResponse{}, errormap.ErrInvalidInput
	}

	// Demo/sample phone: skip Kavenegar entirely (verifyOTP accepts any code).
	if s.isDemoPhone(phone) {
		s.logger.InfoContext(ctx, "otp demo phone: skipping sms send", "phone", phone)
		return OTPRequestResponse{Message: "verification code sent", ExpiresIn: int(s.cfg.OTPTTL.Seconds())}, nil
	}

	// Rate-limit resends so we don't burn SMS credit or enable bombing.
	if existing, err := s.otps.FindByID(ctx, phone); err == nil {
		if wait := s.cfg.OTPResendCooldown - time.Since(existing.CreatedAt); wait > 0 {
			return OTPRequestResponse{}, fmt.Errorf("%w: please wait %d seconds before requesting a new code", errormap.ErrConflict, int(wait.Seconds())+1)
		}
	} else if !errors.Is(err, database.ErrNotFound) {
		return OTPRequestResponse{}, err
	}

	code, err := generateNumericCode(s.cfg.OTPCodeLength)
	if err != nil {
		return OTPRequestResponse{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return OTPRequestResponse{}, err
	}

	now := time.Now().UTC()
	record := OTPCode{
		Phone:     phone,
		CodeHash:  string(hash),
		ExpiresAt: now.Add(s.cfg.OTPTTL),
		Attempts:  0,
		CreatedAt: now,
	}
	if _, err := s.otps.Collection().ReplaceOne(ctx, bson.M{"_id": phone}, record, options.Replace().SetUpsert(true)); err != nil {
		return OTPRequestResponse{}, err
	}

	if err := s.sms.SendOTP(ctx, phone, code); err != nil {
		// Drop the stored code so the user can retry immediately after a send failure.
		_ = s.otps.Delete(ctx, phone)
		s.logger.ErrorContext(ctx, "failed to send otp", "phone", phone, "error", err)
		return OTPRequestResponse{}, fmt.Errorf("could not send verification code: %w", err)
	}

	return OTPRequestResponse{Message: "verification code sent", ExpiresIn: int(s.cfg.OTPTTL.Seconds())}, nil
}

func (s *Service) verifyOTP(ctx context.Context, req OTPVerifyRequest) (AuthResponse, error) {
	phone, ok := normalizeOTPPhone(req.Phone)
	if !ok {
		return AuthResponse{}, errormap.ErrInvalidInput
	}

	// Demo/sample phone: accept any code without checking Kavenegar or a stored code.
	if s.isDemoPhone(phone) {
		user, err := s.findOrCreateCustomer(ctx, phone)
		if err != nil {
			return AuthResponse{}, err
		}
		return s.issueSession(user)
	}

	record, err := s.otps.FindByID(ctx, phone)
	if errors.Is(err, database.ErrNotFound) {
		return AuthResponse{}, errormap.ErrUnauthorized
	}
	if err != nil {
		return AuthResponse{}, err
	}

	if time.Now().UTC().After(record.ExpiresAt) || record.Attempts >= s.cfg.OTPMaxAttempts {
		_ = s.otps.Delete(ctx, phone)
		return AuthResponse{}, errormap.ErrUnauthorized
	}

	if err := bcrypt.CompareHashAndPassword([]byte(record.CodeHash), []byte(strings.TrimSpace(req.Code))); err != nil {
		_ = s.otps.Update(ctx, phone, bson.M{"$inc": bson.M{"attempts": 1}})
		return AuthResponse{}, errormap.ErrUnauthorized
	}

	// Code is correct; consume it so it can't be replayed.
	_ = s.otps.Delete(ctx, phone)

	user, err := s.findOrCreateCustomer(ctx, phone)
	if err != nil {
		return AuthResponse{}, err
	}
	return s.issueSession(user)
}

// forgotPassword sends a reset code to an existing account's phone, reusing the
// OTP storage/TTL/cooldown and demo-phone bypass. It does not reveal whether the
// phone exists when the SMS path is taken, but a missing account short-circuits
// to avoid burning SMS credit.
func (s *Service) forgotPassword(ctx context.Context, req ForgotPasswordRequest) (OTPRequestResponse, error) {
	phone, ok := normalizeOTPPhone(req.Phone)
	if !ok {
		return OTPRequestResponse{}, errormap.ErrInvalidInput
	}

	user, err := s.users.FindOne(ctx, bson.M{"phone": phone})
	if errors.Is(err, database.ErrNotFound) {
		// Don't disclose account existence; pretend a code was sent.
		return OTPRequestResponse{Message: "if the number exists, a reset code was sent", ExpiresIn: int(s.cfg.OTPTTL.Seconds())}, nil
	}
	if err != nil {
		return OTPRequestResponse{}, err
	}
	if user.Role == RoleCustomer {
		return OTPRequestResponse{}, fmt.Errorf("%w: customers sign in with a one-time code, not a password", errormap.ErrInvalidInput)
	}

	if s.isDemoPhone(phone) {
		s.logger.InfoContext(ctx, "password reset demo phone: skipping sms send", "phone", phone)
		return OTPRequestResponse{Message: "reset code sent", ExpiresIn: int(s.cfg.OTPTTL.Seconds())}, nil
	}

	if existing, err := s.otps.FindByID(ctx, phone); err == nil {
		if wait := s.cfg.OTPResendCooldown - time.Since(existing.CreatedAt); wait > 0 {
			return OTPRequestResponse{}, fmt.Errorf("%w: please wait %d seconds before requesting a new code", errormap.ErrConflict, int(wait.Seconds())+1)
		}
	} else if !errors.Is(err, database.ErrNotFound) {
		return OTPRequestResponse{}, err
	}

	code, err := generateNumericCode(s.cfg.OTPCodeLength)
	if err != nil {
		return OTPRequestResponse{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
	if err != nil {
		return OTPRequestResponse{}, err
	}
	now := time.Now().UTC()
	record := OTPCode{Phone: phone, CodeHash: string(hash), ExpiresAt: now.Add(s.cfg.OTPTTL), CreatedAt: now}
	if _, err := s.otps.Collection().ReplaceOne(ctx, bson.M{"_id": phone}, record, options.Replace().SetUpsert(true)); err != nil {
		return OTPRequestResponse{}, err
	}
	if err := s.sms.SendOTP(ctx, phone, code); err != nil {
		_ = s.otps.Delete(ctx, phone)
		s.logger.ErrorContext(ctx, "failed to send reset code", "phone", phone, "error", err)
		return OTPRequestResponse{}, fmt.Errorf("could not send reset code: %w", err)
	}
	return OTPRequestResponse{Message: "reset code sent", ExpiresIn: int(s.cfg.OTPTTL.Seconds())}, nil
}

// resetPassword verifies the reset code and sets a new password, clearing any
// brute-force lock.
func (s *Service) resetPassword(ctx context.Context, req ResetPasswordRequest) error {
	phone, ok := normalizeOTPPhone(req.Phone)
	if !ok {
		return errormap.ErrInvalidInput
	}

	user, err := s.users.FindOne(ctx, bson.M{"phone": phone})
	if errors.Is(err, database.ErrNotFound) {
		return errormap.ErrUnauthorized
	}
	if err != nil {
		return err
	}

	if !s.isDemoPhone(phone) {
		record, err := s.otps.FindByID(ctx, phone)
		if errors.Is(err, database.ErrNotFound) {
			return errormap.ErrUnauthorized
		}
		if err != nil {
			return err
		}
		if time.Now().UTC().After(record.ExpiresAt) || record.Attempts >= s.cfg.OTPMaxAttempts {
			_ = s.otps.Delete(ctx, phone)
			return errormap.ErrUnauthorized
		}
		if err := bcrypt.CompareHashAndPassword([]byte(record.CodeHash), []byte(strings.TrimSpace(req.Code))); err != nil {
			_ = s.otps.Update(ctx, phone, bson.M{"$inc": bson.M{"attempts": 1}})
			return errormap.ErrUnauthorized
		}
		_ = s.otps.Delete(ctx, phone)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.users.Update(ctx, user.ID, bson.M{
		"$set":   bson.M{"password_hash": string(hash), "failed_logins": 0, "updated_at": time.Now().UTC()},
		"$unset": bson.M{"locked_until": ""},
	})
}

// isDemoPhone reports whether the phone is the configured demo/sample number,
// which bypasses Kavenegar and accepts any code — handy for demos and for local
// dev without a working SMS account. Blank OTP_DEMO_PHONE to disable it.
func (s *Service) isDemoPhone(phone string) bool {
	return s.cfg.OTPDemoPhone != "" && phone == s.cfg.OTPDemoPhone
}

// normalizeOTPPhone canonicalizes Iranian mobiles to 09XXXXXXXXX for storage
// and Kavenegar delivery.
func normalizeOTPPhone(raw string) (string, bool) {
	return validator.NormalizeIranMobile(raw)
}

// issueSession mints an access token for an active user.
func (s *Service) issueSession(user User) (AuthResponse, error) {
	if user.Status != UserStatusActive {
		return AuthResponse{}, errormap.ErrForbidden
	}
	token, err := sansyarjwt.Issue(s.cfg.JWTSecret, s.cfg.AccessTokenTTL, user.ID, user.Role)
	if err != nil {
		return AuthResponse{}, err
	}
	return AuthResponse{AccessToken: token, TokenType: "Bearer", User: user}, nil
}

// findOrCreateCustomer returns the customer for the phone, creating one on first
// OTP login. Phones belonging to staff/owner/admin accounts are rejected — those
// roles must sign in with a password, not OTP.
func (s *Service) findOrCreateCustomer(ctx context.Context, phone string) (User, error) {
	user, err := s.users.FindOne(ctx, bson.M{"phone": phone})
	if err == nil {
		if user.Role != RoleCustomer {
			return User{}, fmt.Errorf("%w: this account must sign in with a password", errormap.ErrForbidden)
		}
		return user, nil
	}
	if !errors.Is(err, database.ErrNotFound) {
		return User{}, err
	}

	now := time.Now().UTC()
	user = User{
		ID:        uuid.NewString(),
		Phone:     phone,
		Role:      RoleCustomer,
		Status:    UserStatusActive,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.users.Create(ctx, user); err != nil {
		return User{}, err
	}
	return user, nil
}

func generateNumericCode(length int) (string, error) {
	if length <= 0 {
		length = 5
	}
	var b strings.Builder
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		b.WriteString(n.String())
	}
	return b.String(), nil
}
