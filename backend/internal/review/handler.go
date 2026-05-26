package review

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
	reviews *database.Repository[Review]
}

func NewHandler(reviews *database.Repository[Review]) *Handler {
	return &Handler{reviews: reviews}
}

func (h *Handler) List(c echo.Context) error {
	items, err := h.reviews.FindAll(c.Request().Context(), bson.M{"complex_id": c.Param("complexId"), "status": "approved"}, database.Page{Limit: 50, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) Create(c echo.Context) error {
	var req struct {
		ComplexID string `json:"complex_id" validate:"required"`
		Rating    int    `json:"rating" validate:"required,min=1,max=5"`
		Comment   string `json:"comment"`
	}
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid review payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	now := time.Now().UTC()
	item := Review{ID: uuid.NewString(), BookingID: c.Param("bookingId"), ComplexID: req.ComplexID, CustomerID: requestctx.UserID(c.Request().Context()), Rating: req.Rating, Comment: req.Comment, Status: "pending", CreatedAt: now, UpdatedAt: now}
	if err := h.reviews.Create(c.Request().Context(), item); err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) Reply(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "reply_saved"})
}

func (h *Handler) Moderate(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "moderated"})
}
