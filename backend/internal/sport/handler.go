package sport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c echo.Context) error {
	items, err := h.service.list(c.Request().Context(), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) Create(c echo.Context) error {
	var req CreateSportRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid sport payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.create(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) Update(c echo.Context) error {
	var req UpdateSportRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid sport payload")
	}
	item, err := h.service.update(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Delete(c echo.Context) error {
	if err := h.service.delete(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}
