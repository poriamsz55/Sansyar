package discovery

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Stats(c echo.Context) error {
	stats, err := h.service.publicStats(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *Handler) Featured(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	items, err := h.service.featuredComplexes(c.Request().Context(), limit)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) BookingCount(c echo.Context) error {
	count, err := h.service.bookingCountForComplex(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, map[string]int64{"booking_count": count})
}
