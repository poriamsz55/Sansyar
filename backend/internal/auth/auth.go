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
		ID           string     `json:"id" bson:"_id"`
		FullName     string     `json:"full_name" bson:"full_name"`
		FirstName    string     `json:"first_name,omitempty" bson:"first_name,omitempty"`
		LastName     string     `json:"last_name,omitempty" bson:"last_name,omitempty"`
		NationalID   string     `json:"national_id,omitempty" bson:"national_id,omitempty"`
		Address      string     `json:"address,omitempty" bson:"address,omitempty"`
		Phone        string     `json:"phone" bson:"phone"`
		Email        string     `json:"email,omitempty" bson:"email,omitempty"`
		PasswordHash string     `json:"-" bson:"password_hash"`
		Role         string     `json:"role" bson:"role"`
		Status       string     `json:"status" bson:"status"`
		FailedLogins int        `json:"-" bson:"failed_logins"`
		LockedUntil  *time.Time `json:"-" bson:"locked_until,omitempty"`
		CreatedAt    time.Time  `json:"created_at" bson:"created_at"`
		UpdatedAt    time.Time  `json:"updated_at" bson:"updated_at"`
	}

	RegisterRequest struct {
		FullName string `json:"full_name" validate:"required,min=2"`
		Phone    string `json:"phone" validate:"required,min=8"`
		Email    string `json:"email"`
		Password string `json:"password" validate:"required,min=8"`
		Role     string `json:"role"`
	}

	// RegisterOwnerRequest is the self-service Vendor Admin (venue owner) signup
	// payload. National code and mobile are format-validated and must be unique.
	RegisterOwnerRequest struct {
		FirstName       string `json:"first_name" validate:"required,min=2"`
		LastName        string `json:"last_name" validate:"required,min=2"`
		NationalID      string `json:"national_id" validate:"required,irnationalcode"`
		Phone           string `json:"phone" validate:"required,irmobile"`
		Address         string `json:"address" validate:"required,min=5"`
		Password        string `json:"password" validate:"required,strongpassword"`
		ConfirmPassword string `json:"confirm_password" validate:"required,eqfield=Password"`
	}

	LoginRequest struct {
		Phone      string `json:"phone" validate:"required"`
		Password   string `json:"password" validate:"required"`
		RememberMe bool   `json:"remember_me"`
	}

	ForgotPasswordRequest struct {
		Phone string `json:"phone" validate:"required,irmobile"`
	}

	ResetPasswordRequest struct {
		Phone       string `json:"phone" validate:"required,irmobile"`
		Code        string `json:"code" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,strongpassword"`
	}

	AuthResponse struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		User        User   `json:"user"`
	}

	CreateUserRequest struct {
		FullName string `json:"full_name" validate:"required,min=2"`
		Phone    string `json:"phone" validate:"required,min=8"`
		Email    string `json:"email"`
		Password string `json:"password" validate:"required,min=8"`
		Role     string `json:"role" validate:"required"`
	}

	UpdateUserRequest struct {
		FullName *string `json:"full_name"`
		Phone    *string `json:"phone"`
		Email    *string `json:"email"`
		Status   *string `json:"status"`
		Role     *string `json:"role"`
	}

	UserWithComplexCount struct {
		User
		ComplexCount int `json:"complex_count"`
	}
)
