package store

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

// ---- Customer: addresses -----------------------------------------------------

func (h *Handler) ListAddresses(c echo.Context) error {
	items, err := h.service.ListAddresses(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateAddress(c echo.Context) error {
	var req CreateAddressRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid address payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.CreateAddress(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateAddress(c echo.Context) error {
	var req UpdateAddressRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid address payload")
	}
	item, err := h.service.UpdateAddress(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteAddress(c echo.Context) error {
	if err := h.service.DeleteAddress(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ---- Customer: settings & checkout --------------------------------------------

// PublicSettings exposes what the storefront needs (shipping methods etc.).
func (h *Handler) PublicSettings(c echo.Context) error {
	settings, err := h.service.GetSettings(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, settings)
}

func (h *Handler) Checkout(c echo.Context) error {
	var req CheckoutRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid checkout payload")
	}
	if req.NewAddress == nil && req.AddressID == "" {
		return errormap.Input(c, "آدرس ارسال الزامی است")
	}
	userID := requestctx.UserID(c.Request().Context())
	// The Idempotency-Key header guards against double-submitting a checkout
	// (retrying clients, double clicks).
	idempotencyKey := c.Request().Header.Get("Idempotency-Key")
	order, err := h.service.Checkout(c.Request().Context(), userID, c.Request().Header.Get(CartTokenHeader), idempotencyKey, req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, order)
}

func (h *Handler) MyOrders(c echo.Context) error {
	items, err := h.service.ListMyOrders(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetMyOrder(c echo.Context) error {
	order, err := h.service.GetMyOrder(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, order)
}

func (h *Handler) CancelMyOrder(c echo.Context) error {
	order, err := h.service.CancelMyOrder(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, order)
}

// ---- Admin: orders ---------------------------------------------------------------

func (h *Handler) ListOrdersAdmin(c echo.Context) error {
	result, err := h.service.ListOrdersAdmin(c.Request().Context(), AdminOrderFilter{
		Status:        c.QueryParam("status"),
		PaymentStatus: c.QueryParam("payment_status"),
		Q:             c.QueryParam("q"),
		Page:          queryInt(c, "page", 1),
		Limit:         queryInt(c, "limit", 20),
	})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) GetOrderAdmin(c echo.Context) error {
	order, err := h.service.GetOrderAdmin(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, order)
}

func (h *Handler) UpdateOrderStatus(c echo.Context) error {
	var req UpdateOrderStatusRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid status payload")
	}
	order, err := h.service.UpdateOrderStatus(
		c.Request().Context(), c.Param("id"), req.Status,
		requestctx.UserID(c.Request().Context()), req.Note, req.TrackingCode,
	)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, order)
}

// ---- Admin: inventory -----------------------------------------------------

func (h *Handler) AdjustStock(c echo.Context) error {
	var req AdjustStockRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid stock payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	variant, log, err := h.service.AdjustStock(
		c.Request().Context(), c.Param("id"), req.Delta, req.Reason,
		requestctx.UserID(c.Request().Context()),
	)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, map[string]any{"variant": variant, "log": log})
}

func (h *Handler) ListInventoryLogs(c echo.Context) error {
	logs, err := h.service.ListInventoryLogs(c.Request().Context(), InventoryFilter{
		VariantID: c.QueryParam("variant_id"),
		ProductID: c.QueryParam("product_id"),
		OrderID:   c.QueryParam("order_id"),
		Limit:     queryInt(c, "limit", 100),
	})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, logs)
}

func (h *Handler) ListInventory(c echo.Context) error {
	rows, err := h.service.ListInventory(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, rows)
}

func (h *Handler) StatsAdmin(c echo.Context) error {
	stats, err := h.service.StatsAdmin(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, stats)
}

func (h *Handler) UpdateSettingsAdmin(c echo.Context) error {
	var req UpdateSettingsRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid settings payload")
	}
	settings, err := h.service.UpdateSettingsAdmin(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, settings)
}

func (h *Handler) ListCustomersAdmin(c echo.Context) error {
	rows, err := h.service.ListCustomersAdmin(c.Request().Context())
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, rows)
}
