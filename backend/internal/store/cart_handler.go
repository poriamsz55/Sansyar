package store

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

// cartScope extracts (userID, token) for the current request. The cart token
// header identifies guests; a bearer token identifies the logged-in shopper.
func cartScope(c echo.Context) (string, string) {
	return requestctx.UserID(c.Request().Context()), c.Request().Header.Get(CartTokenHeader)
}

// respondCart writes the cart view; for brand-new guest carts it also emits
// the generated token so the client can persist it.
func respondCart(c echo.Context, view CartView, newToken string, err error) error {
	if err != nil {
		return errormap.JSON(c, err)
	}
	if newToken != "" {
		c.Response().Header().Set(CartTokenHeader, newToken)
		return c.JSON(http.StatusOK, map[string]any{"cart": view, "cart_token": newToken})
	}
	return c.JSON(http.StatusOK, map[string]any{"cart": view})
}

// GetCart renders the caller's cart with live prices (never trusts stored
// prices; the document only holds variant references and quantities).
func (h *Handler) GetCart(c echo.Context) error {
	userID, token := cartScope(c)
	view, err := h.service.CartView(c.Request().Context(), userID, token)
	return respondCart(c, view, "", err)
}

func (h *Handler) AddCartItem(c echo.Context) error {
	var req AddCartItemRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid cart payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	userID, token := cartScope(c)
	view, newToken, err := h.service.AddToCart(c.Request().Context(), userID, token, req)
	return respondCart(c, view, newToken, err)
}

func (h *Handler) UpdateCartItem(c echo.Context) error {
	var req UpdateCartItemRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid cart payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	userID, token := cartScope(c)
	view, err := h.service.SetCartItemQty(c.Request().Context(), userID, token, c.Param("variantId"), req.Qty)
	return respondCart(c, view, "", err)
}

func (h *Handler) RemoveCartItem(c echo.Context) error {
	userID, token := cartScope(c)
	view, err := h.service.RemoveCartItem(c.Request().Context(), userID, token, c.Param("variantId"))
	return respondCart(c, view, "", err)
}

func (h *Handler) ClearCart(c echo.Context) error {
	userID, token := cartScope(c)
	view, err := h.service.ClearCart(c.Request().Context(), userID, token)
	return respondCart(c, view, "", err)
}
