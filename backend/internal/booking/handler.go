package booking

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Create(c echo.Context) error {
	var req CreateBookingRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid booking payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.create(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Request().Header.Get("Idempotency-Key"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) MyBookings(c echo.Context) error {
	items, err := h.service.listForCustomer(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) Cancel(c echo.Context) error {
	item, err := h.service.cancel(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) OwnerBookings(c echo.Context) error {
	return c.JSON(http.StatusOK, []Booking{})
}

func (h *Handler) AdminBookings(c echo.Context) error {
	items, err := h.service.bookings.FindAll(c.Request().Context(), bson.M{}, database.Page{Limit: 200, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}
