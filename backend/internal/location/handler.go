package location

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
	items, err := h.service.list(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}
