package auth

import (
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

// registrationMessage turns the first validation failure into a user-facing
// Persian message so the signup form can show something actionable.
func registrationMessage(err error) string {
	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) || len(verrs) == 0 {
		return err.Error()
	}
	fe := verrs[0]
	switch fe.Field() {
	case "FirstName":
		return "نام را وارد کنید"
	case "LastName":
		return "نام خانوادگی را وارد کنید"
	case "NationalID":
		return "کد ملی معتبر نیست"
	case "Phone":
		return "شماره موبایل معتبر نیست (۰۹xxxxxxxxx)"
	case "Address":
		return "آدرس را کامل وارد کنید"
	case "Password":
		return "رمز عبور باید حداقل ۸ کاراکتر و شامل حروف و اعداد باشد"
	case "ConfirmPassword":
		return "تکرار رمز عبور با رمز عبور یکسان نیست"
	default:
		return "اطلاعات واردشده معتبر نیست"
	}
}

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid registration payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}

	res, err := h.service.register(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) RegisterOwner(c echo.Context) error {
	var req RegisterOwnerRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid registration payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, registrationMessage(err))
	}

	res, err := h.service.registerOwner(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, res)
}

func (h *Handler) ForgotPassword(c echo.Context) error {
	var req ForgotPasswordRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid request payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, "Enter a valid mobile number")
	}
	res, err := h.service.forgotPassword(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) ResetPassword(c echo.Context) error {
	var req ResetPasswordRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid request payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, "Enter the code and a strong new password (min 8 chars, letters and digits)")
	}
	if err := h.service.resetPassword(c.Request().Context(), req); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid login payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}

	res, err := h.service.login(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) RequestOTP(c echo.Context) error {
	var req OTPRequestRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid OTP request payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, "شماره موبایل معتبر نیست (۰۹xxxxxxxxx)")
	}

	res, err := h.service.requestOTP(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) VerifyOTP(c echo.Context) error {
	var req OTPVerifyRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid OTP verify payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, "شماره موبایل یا کد تایید معتبر نیست")
	}

	res, err := h.service.verifyOTP(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) Refresh(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"message": "refresh token rotation will be enabled with the production auth provider"})
}

func (h *Handler) Logout(c echo.Context) error {
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) Me(c echo.Context) error {
	user, err := h.service.me(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, user)
}

func (h *Handler) UpdateProfile(c echo.Context) error {
	var req UpdateProfileRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid profile payload")
	}
	user, err := h.service.updateProfile(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, user)
}

func (h *Handler) ListUsers(c echo.Context) error {
	items, err := h.service.listUsers(c.Request().Context(), c.QueryParam("role"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateUser(c echo.Context) error {
	var req CreateUserRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid user payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	user, err := h.service.createUser(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, user)
}

func (h *Handler) UpdateUser(c echo.Context) error {
	var req UpdateUserRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid user payload")
	}
	user, err := h.service.updateUser(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, user)
}

func (h *Handler) SuspendUser(c echo.Context) error {
	if err := h.service.suspendUser(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) AdminResetPassword(c echo.Context) error {
	plain, err := h.service.adminResetPassword(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, map[string]string{"password": plain})
}
