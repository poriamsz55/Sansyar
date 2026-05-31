package auth

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

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
