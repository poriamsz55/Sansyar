package finance

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) OwnerSummary(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]any{
		"total_revenue":       0,
		"online_payments":     0,
		"deposits":            0,
		"refunds":             0,
		"platform_commission": 0,
		"net_settlement":      0,
	})
}

func (h *Handler) Transactions(c echo.Context) error {
	return c.JSON(http.StatusOK, []map[string]any{})
}

func (h *Handler) AdminSummary(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]any{"platform_revenue": 0, "failed_payments": 0, "pending_settlements": 0})
}

func (h *Handler) Settlements(c echo.Context) error {
	return c.JSON(http.StatusOK, []map[string]any{})
}
