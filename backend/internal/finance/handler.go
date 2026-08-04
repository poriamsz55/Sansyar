package finance

import (
	"net/http"
	"time"

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

func (h *Handler) OwnerSummary(c echo.Context) error {
	item, err := h.service.ownerSummary(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) OwnerAnalytics(c echo.Context) error {
	item, err := h.service.ownerAnalytics(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Transactions(c echo.Context) error {
	items, err := h.service.ownerTransactions(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) AdminSummary(c echo.Context) error {
	item, err := h.service.adminSummary(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

// parseDateParam accepts either RFC3339 or a plain YYYY-MM-DD date, returning
// the zero time (meaning "unbounded") if the param is empty or unparsable.
func parseDateParam(v string) time.Time {
	if v == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339, v); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02", v); err == nil {
		return t
	}
	return time.Time{}
}

func (h *Handler) AdminAnalytics(c echo.Context) error {
	from := parseDateParam(c.QueryParam("from"))
	to := parseDateParam(c.QueryParam("to"))
	item, err := h.service.adminAnalytics(c.Request().Context(), from, to)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

// Settlements has no real payout system to report on yet.
func (h *Handler) Settlements(c echo.Context) error {
	return c.JSON(http.StatusOK, []map[string]any{})
}
