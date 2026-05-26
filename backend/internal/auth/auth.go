package auth

import "time"

const (
	RoleSuperAdmin   = "super_admin"
	RoleVenueOwner   = "venue_owner"
	RoleVenueManager = "venue_manager"
	RoleStaff        = "staff"
	RoleCustomer     = "customer"

	UserStatusActive    = "active"
	UserStatusSuspended = "suspended"
)

type (
	User struct {
		ID           string    `json:"id" bson:"_id"`
		FullName     string    `json:"full_name" bson:"full_name"`
		Phone        string    `json:"phone" bson:"phone"`
		Email        string    `json:"email,omitempty" bson:"email,omitempty"`
		PasswordHash string    `json:"-" bson:"password_hash"`
		Role         string    `json:"role" bson:"role"`
		Status       string    `json:"status" bson:"status"`
		CreatedAt    time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt    time.Time `json:"updated_at" bson:"updated_at"`
	}

	RegisterRequest struct {
		FullName string `json:"full_name" validate:"required,min=2"`
		Phone    string `json:"phone" validate:"required,min=8"`
		Email    string `json:"email"`
		Password string `json:"password" validate:"required,min=8"`
		Role     string `json:"role"`
	}

	LoginRequest struct {
		Phone    string `json:"phone" validate:"required"`
		Password string `json:"password" validate:"required"`
	}

	AuthResponse struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		User        User   `json:"user"`
	}
)
