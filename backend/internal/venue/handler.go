package venue

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func parseListParams(c echo.Context) listComplexParams {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	minPrice, _ := strconv.ParseInt(c.QueryParam("min_price"), 10, 64)
	maxPrice, _ := strconv.ParseInt(c.QueryParam("max_price"), 10, 64)
	return listComplexParams{
		City:     c.QueryParam("city"),
		Status:   c.QueryParam("status"),
		Query:    c.QueryParam("q"),
		Page:     page,
		Limit:    limit,
		SportID:  c.QueryParam("sport_id"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
	}
}

func (h *Handler) ListComplexes(c echo.Context) error {
	result, err := h.service.listComplexesPaginated(c.Request().Context(), parseListParams(c))
	if err != nil {
		return errormap.JSON(c, err)
	}
	// Staged edits are moderation-internal; never expose them publicly.
	for i := range result.Items {
		result.Items[i].PendingChanges = nil
	}
	if c.QueryParam("page") != "" || c.QueryParam("limit") != "" {
		return c.JSON(http.StatusOK, result)
	}
	return c.JSON(http.StatusOK, result.Items)
}

func (h *Handler) ListOwnerComplexes(c echo.Context) error {
	params := parseListParams(c)
	params.AllStatuses = true
	params.OwnerID = h.service.ownerIDForRole(
		requestctx.UserID(c.Request().Context()),
		requestctx.Role(c.Request().Context()),
	)
	params.Status = c.QueryParam("status")
	result, err := h.service.listComplexesPaginated(c.Request().Context(), params)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result.Items)
}

func (h *Handler) ListAdminComplexes(c echo.Context) error {
	params := parseListParams(c)
	params.AllStatuses = true
	params.Status = c.QueryParam("status")
	result, err := h.service.listComplexesPaginated(c.Request().Context(), params)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result.Items)
}

func (h *Handler) GetComplex(c echo.Context) error {
	item, err := h.service.getComplexSummary(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	if !complexIsPublic(item.Complex) {
		return errormap.JSON(c, errormap.ErrNotFound)
	}
	// Staged edits are moderation-internal; never expose them publicly.
	item.PendingChanges = nil
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) AdminCreateComplex(c echo.Context) error {
	var req struct {
		OwnerID string `json:"owner_id" validate:"required"`
		CreateComplexRequest
	}
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid complex payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.adminCreateComplex(c.Request().Context(), req.OwnerID, req.CreateComplexRequest)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) AdminUpdateComplex(c echo.Context) error {
	var req UpdateComplexRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid complex payload")
	}
	item, err := h.service.updateComplex(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) AdminDeleteComplex(c echo.Context) error {
	if err := h.service.deleteComplex(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) PublishComplex(c echo.Context) error {
	item, err := h.service.publishComplex(c.Request().Context(), c.Param("id"), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) UnpublishComplex(c echo.Context) error {
	item, err := h.service.publishComplex(c.Request().Context(), c.Param("id"), false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) AdminUpdateHall(c echo.Context) error {
	var req UpdateHallRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid hall payload")
	}
	item, err := h.service.updateHall(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) AdminDeleteHall(c echo.Context) error {
	if err := h.service.deleteHall(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) PublishHall(c echo.Context) error {
	item, err := h.service.publishHall(c.Request().Context(), c.Param("id"), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) UnpublishHall(c echo.Context) error {
	item, err := h.service.publishHall(c.Request().Context(), c.Param("id"), false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) CreateComplex(c echo.Context) error {
	var req CreateComplexRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid complex payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.createComplex(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateComplex(c echo.Context) error {
	var req UpdateComplexRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid complex payload")
	}
	item, err := h.service.updateComplex(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteComplex(c echo.Context) error {
	if err := h.service.deleteComplex(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ApproveComplex(c echo.Context) error {
	item, err := h.service.approveComplex(c.Request().Context(), c.Param("id"), ComplexApproved, "")
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) RejectComplex(c echo.Context) error {
	item, err := h.service.approveComplex(c.Request().Context(), c.Param("id"), ComplexRejected, reasonFromBody(c))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) ListAdminHalls(c echo.Context) error {
	items, err := h.service.listAllHalls(c.Request().Context(), c.QueryParam("status"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) ApproveHall(c echo.Context) error {
	item, err := h.service.approveHall(c.Request().Context(), c.Param("id"), HallApproved, "")
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) RejectHall(c echo.Context) error {
	item, err := h.service.approveHall(c.Request().Context(), c.Param("id"), HallRejected, reasonFromBody(c))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

// reasonFromBody reads an optional { "reason": "..." } from the request body.
func reasonFromBody(c echo.Context) string {
	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.Bind(&body)
	return body.Reason
}

func (h *Handler) ListHalls(c echo.Context) error {
	complex, err := h.service.getComplex(c.Request().Context(), c.Param("complexId"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	if !complexIsPublic(complex) {
		return c.JSON(http.StatusOK, []Hall{})
	}
	items, err := h.service.listHalls(c.Request().Context(), c.Param("complexId"), true, true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) ListOwnerHalls(c echo.Context) error {
	ownerID := requestctx.UserID(c.Request().Context())
	complexID := c.Param("complexId")
	if err := h.service.assertComplexOwner(c.Request().Context(), complexID, ownerID); err != nil {
		return errormap.JSON(c, err)
	}
	items, err := h.service.listHalls(c.Request().Context(), complexID, c.QueryParam("include_inactive") != "true", false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetHall(c echo.Context) error {
	item, err := h.service.getHall(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	if !hallIsPublic(item) {
		return errormap.JSON(c, errormap.ErrNotFound)
	}
	complex, err := h.service.getComplex(c.Request().Context(), item.ComplexID)
	if err != nil || !complexIsPublic(complex) {
		return errormap.JSON(c, errormap.ErrNotFound)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) CreateHall(c echo.Context) error {
	var req CreateHallRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid hall payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.createHall(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("complexId"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateHall(c echo.Context) error {
	var req UpdateHallRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid hall payload")
	}
	item, err := h.service.updateHall(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteHall(c echo.Context) error {
	if err := h.service.deleteHall(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) CreateSlot(c echo.Context) error {
	var req CreateSlotRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid slot payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.createSlot(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateSlot(c echo.Context) error {
	var req UpdateSlotRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid slot payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.updateSlot(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

// ---- Session management (owner calendar) ---------------------------------

func (h *Handler) DeleteSlot(c echo.Context) error {
	if err := h.service.deleteSlot(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ListSessions(c echo.Context) error {
	ownerID := requestctx.UserID(c.Request().Context())
	var from, to time.Time
	if v := c.QueryParam("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return errormap.Input(c, "from must be an RFC3339 timestamp")
		}
		from = t
	}
	if v := c.QueryParam("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return errormap.Input(c, "to must be an RFC3339 timestamp")
		}
		to = t
	}
	items, err := h.service.listSessions(c.Request().Context(), ownerID, c.QueryParam("hall_id"), c.QueryParam("complex_id"), from, to)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GenerateSessions(c echo.Context) error {
	var req GenerateSessionsRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid generation payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	res, err := h.service.generateSessions(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) CopyDay(c echo.Context) error {
	var req CopyDayRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid copy payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	res, err := h.service.copyDay(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) DuplicateWeek(c echo.Context) error {
	var req DuplicateWeekRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid duplicate payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	res, err := h.service.duplicateWeek(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) BulkUpdateSessions(c echo.Context) error {
	var req BulkUpdateSessionsRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid bulk payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	res, err := h.service.bulkUpdate(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) BlockRange(c echo.Context) error {
	var req BlockRangeRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid block payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	res, err := h.service.blockRange(c.Request().Context(), requestctx.UserID(c.Request().Context()), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, res)
}

func (h *Handler) SessionAudit(c echo.Context) error {
	items, err := h.service.listAudit(c.Request().Context(), requestctx.UserID(c.Request().Context()), c.QueryParam("hall_id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) ListSlots(c echo.Context) error {
	filter := bson.M{}
	if hallID := c.Param("hallId"); hallID != "" {
		filter["hall_id"] = hallID
	}
	if complexID := c.QueryParam("complex_id"); complexID != "" {
		filter["complex_id"] = complexID
	}
	if sportID := c.QueryParam("sport_id"); sportID != "" {
		filter["sport_id"] = sportID
	}
	if status := c.QueryParam("status"); status != "" {
		filter["status"] = status
	} else {
		filter["status"] = bson.M{"$nin": bson.A{SlotExpired}}
	}
	if date := c.QueryParam("date"); date != "" {
		day, err := time.Parse("2006-01-02", date)
		if err != nil {
			return errormap.Input(c, "date must use YYYY-MM-DD")
		}
		now := time.Now().UTC()
		start := day
		end := day.Add(24 * time.Hour)
		if start.Before(now) {
			start = now
		}
		if !start.Before(end) {
			return c.JSON(http.StatusOK, []Slot{})
		}
		filter["starts_at"] = bson.M{"$gte": start, "$lt": end}
	} else {
		// Customers must not see sessions that can no longer be booked.
		filter["starts_at"] = bson.M{"$gte": time.Now().UTC()}
	}
	items, err := h.service.listSlots(c.Request().Context(), filter)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) MapVenues(c echo.Context) error {
	lat, err := strconv.ParseFloat(c.QueryParam("lat"), 64)
	if err != nil {
		return errormap.Input(c, "lat is required")
	}
	lng, err := strconv.ParseFloat(c.QueryParam("lng"), 64)
	if err != nil {
		return errormap.Input(c, "lng is required")
	}
	radius, _ := strconv.ParseInt(c.QueryParam("radius"), 10, 64)
	items, err := h.service.mapVenues(
		c.Request().Context(),
		lat,
		lng,
		radius,
		c.QueryParam("sport_id"),
		c.QueryParam("discount_only") == "true",
		c.QueryParam("available_only") == "true",
	)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}
