package store

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

// InitiateOrderPayment starts a payment attempt for a pending order and
// returns the dev gateway URL. Amounts are server-side only.
func (h *Handler) InitiateOrderPayment(c echo.Context) error {
	payment, err := h.service.InitiateOrderPayment(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, map[string]any{
		"payment":      payment,
		"redirect_url": "/store/pay/" + payment.ID,
	})
}

// CompleteOrderPayment is the (simulated) provider callback for the dev
// gateway: {"result":"success"|"failure"}.
func (h *Handler) CompleteOrderPayment(c echo.Context) error {
	var req CompletePaymentRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid payment result")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	order, payment, err := h.service.CompleteOrderPayment(
		c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req.Result,
	)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"order": order, "payment": payment})
}
