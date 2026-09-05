package store

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

// ApplyCoupon validates a discount code against the caller's cart.
func (h *Handler) ApplyCoupon(c echo.Context) error {
	var req ApplyCouponRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid coupon payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	userID := requestctx.UserID(c.Request().Context())
	view, err := h.service.ApplyCoupon(c.Request().Context(), userID, c.Request().Header.Get(CartTokenHeader), req.Code)
	return respondCart(c, view, "", err)
}

// RemoveCoupon drops the applied code.
func (h *Handler) RemoveCoupon(c echo.Context) error {
	userID := requestctx.UserID(c.Request().Context())
	view, err := h.service.RemoveCoupon(c.Request().Context(), userID, c.Request().Header.Get(CartTokenHeader))
	return respondCart(c, view, "", err)
}

// ---- Admin ----

func (h *Handler) ListCouponsAdmin(c echo.Context) error {
	items, err := h.service.ListCouponsAdmin(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateCouponAdmin(c echo.Context) error {
	var req CreateCouponRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid coupon payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.CreateCouponAdmin(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateCouponAdmin(c echo.Context) error {
	var req UpdateCouponRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid coupon payload")
	}
	item, err := h.service.UpdateCouponAdmin(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteCouponAdmin(c echo.Context) error {
	if err := h.service.DeleteCouponAdmin(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}
