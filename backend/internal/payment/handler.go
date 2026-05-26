package payment

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

type Handler struct {
	payments *database.Repository[Payment]
}

func NewHandler(payments *database.Repository[Payment]) *Handler {
	return &Handler{payments: payments}
}

func (h *Handler) Initiate(c echo.Context) error {
	var req InitiateRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid payment payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	now := time.Now().UTC()
	item := Payment{ID: uuid.NewString(), BookingID: req.BookingID, UserID: requestctx.UserID(c.Request().Context()), Amount: req.Amount, Status: StatusUnpaid, Provider: "fake", RefID: "dev-" + uuid.NewString(), CreatedAt: now}
	if err := h.payments.Create(c.Request().Context(), item); err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, map[string]any{"payment": item, "redirect_url": "/dev/fake-payment/" + item.ID})
}

func (h *Handler) Verify(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": StatusPaid, "provider": "fake"})
}

func (h *Handler) Webhook(c echo.Context) error {
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) MyPayments(c echo.Context) error {
	items, err := h.payments.FindAll(c.Request().Context(), bson.M{"user_id": requestctx.UserID(c.Request().Context())}, database.Page{Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}
