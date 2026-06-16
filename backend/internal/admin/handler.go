package admin

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListVenues(c echo.Context) error {
	items, err := h.service.listVenues(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetVenue(c echo.Context) error {
	item, err := h.service.getVenue(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) ListOwners(c echo.Context) error {
	items, err := h.service.listOwners(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetOwner(c echo.Context) error {
	item, err := h.service.getOwner(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) ListCustomers(c echo.Context) error {
	items, err := h.service.listCustomers(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetCustomer(c echo.Context) error {
	item, err := h.service.getCustomer(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) ListBookings(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	f := BookingFilter{
		Status:        c.QueryParam("status"),
		PaymentStatus: c.QueryParam("payment_status"),
		ComplexID:     c.QueryParam("complex_id"),
		CustomerID:    c.QueryParam("customer_id"),
		Query:         c.QueryParam("q"),
		Page:          page,
		Limit:         limit,
	}
	if v := c.QueryParam("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			f.From = t
		}
	}
	if v := c.QueryParam("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			f.To = t.Add(24 * time.Hour)
		}
	}
	result, err := h.service.listBookings(c.Request().Context(), f)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) GetBooking(c echo.Context) error {
	item, err := h.service.getBooking(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}
