package support

import (
	"net/http"
	"strconv"

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

func (h *Handler) Create(c echo.Context) error {
	var req CreateTicketRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid ticket payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.create(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

// MyTickets lists the authenticated user's own ticket submissions.
func (h *Handler) MyTickets(c echo.Context) error {
	items, err := h.service.listForUser(c.Request().Context(), requestctx.UserID(c.Request().Context()))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

// List is the admin inbox: every ticket, optionally filtered/paginated.
func (h *Handler) List(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	result, err := h.service.list(c.Request().Context(), TicketFilter{
		Status:   c.QueryParam("status"),
		Category: c.QueryParam("category"),
		Page:     page,
		Limit:    limit,
	})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) Get(c echo.Context) error {
	item, err := h.service.get(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) UpdateStatus(c echo.Context) error {
	var req UpdateStatusRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid status payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.updateStatus(c.Request().Context(), c.Param("id"), req.Status)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) Reply(c echo.Context) error {
	var req ReplyRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid reply payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.reply(c.Request().Context(), c.Param("id"), req.Reply)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}
