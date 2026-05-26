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

func (h *Handler) ListComplexes(c echo.Context) error {
	items, err := h.service.listComplexes(c.Request().Context(), c.QueryParam("city"), "")
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) GetComplex(c echo.Context) error {
	item, err := h.service.getComplex(c.Request().Context(), c.Param("id"))
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

func (h *Handler) ApproveComplex(c echo.Context) error {
	item, err := h.service.approveComplex(c.Request().Context(), c.Param("id"), ComplexApproved)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) RejectComplex(c echo.Context) error {
	item, err := h.service.approveComplex(c.Request().Context(), c.Param("id"), ComplexRejected)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) ListHalls(c echo.Context) error {
	items, err := h.service.listHalls(c.Request().Context(), c.Param("complexId"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
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

func (h *Handler) ListSlots(c echo.Context) error {
	filter := bson.M{}
	if hallID := c.Param("hallId"); hallID != "" {
		filter["hall_id"] = hallID
	}
	if sportID := c.QueryParam("sport_id"); sportID != "" {
		filter["sport_id"] = sportID
	}
	if status := c.QueryParam("status"); status != "" {
		filter["status"] = status
	}
	if date := c.QueryParam("date"); date != "" {
		day, err := time.Parse("2006-01-02", date)
		if err != nil {
			return errormap.Input(c, "date must use YYYY-MM-DD")
		}
		filter["starts_at"] = bson.M{"$gte": day, "$lt": day.Add(24 * time.Hour)}
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
