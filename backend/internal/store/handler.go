package store

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ---- Public storefront ------------------------------------------------------

func (h *Handler) ListProducts(c echo.Context) error {
	result, err := h.service.ListProductsPublic(c.Request().Context(), parseProductFilter(c))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) GetProduct(c echo.Context) error {
	result, err := h.service.GetProductPublic(c.Request().Context(), c.Param("idOrSlug"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) ListCategories(c echo.Context) error {
	items, err := h.service.ListCategories(c.Request().Context(), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) ListBrands(c echo.Context) error {
	items, err := h.service.ListBrands(c.Request().Context(), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

// ---- Admin: categories & brands ---------------------------------------------

func (h *Handler) ListCategoriesAdmin(c echo.Context) error {
	items, err := h.service.ListCategories(c.Request().Context(), false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateCategory(c echo.Context) error {
	var req CreateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid category payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.CreateCategory(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateCategory(c echo.Context) error {
	var req UpdateCategoryRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid category payload")
	}
	item, err := h.service.UpdateCategory(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteCategory(c echo.Context) error {
	if err := h.service.DeleteCategory(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

func (h *Handler) ListBrandsAdmin(c echo.Context) error {
	items, err := h.service.ListBrands(c.Request().Context(), false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) CreateBrand(c echo.Context) error {
	var req CreateBrandRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid brand payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.CreateBrand(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateBrand(c echo.Context) error {
	var req UpdateBrandRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid brand payload")
	}
	item, err := h.service.UpdateBrand(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteBrand(c echo.Context) error {
	if err := h.service.DeleteBrand(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ---- Admin: products ---------------------------------------------------------

func (h *Handler) ListProductsAdmin(c echo.Context) error {
	result, err := h.service.ListProductsAdmin(c.Request().Context(), parseProductFilter(c))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) GetProductAdmin(c echo.Context) error {
	result, err := h.service.GetProductAdmin(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, result)
}

func (h *Handler) CreateProduct(c echo.Context) error {
	var req CreateProductRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid product payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	item, err := h.service.CreateProduct(c.Request().Context(), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateProduct(c echo.Context) error {
	var req UpdateProductRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid product payload")
	}
	item, err := h.service.UpdateProduct(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) PublishProduct(c echo.Context) error {
	item, err := h.service.SetProductStatus(c.Request().Context(), c.Param("id"), true)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) UnpublishProduct(c echo.Context) error {
	item, err := h.service.SetProductStatus(c.Request().Context(), c.Param("id"), false)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteProduct(c echo.Context) error {
	if err := h.service.DeleteProduct(c.Request().Context(), c.Param("id")); err != nil {
		return errormap.JSON(c, err)
	}
	return c.NoContent(http.StatusNoContent)
}

// ---- Admin: variants ---------------------------------------------------------

func (h *Handler) CreateVariant(c echo.Context) error {
	var req CreateVariantRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid variant payload")
	}
	if err := c.Validate(req); err != nil {
		return errormap.Input(c, err.Error())
	}
	// Returns the refreshed product detail so the UI updates in one round-trip.
	item, err := h.service.CreateVariant(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateVariant(c echo.Context) error {
	var req UpdateVariantRequest
	if err := c.Bind(&req); err != nil {
		return errormap.Input(c, "Invalid variant payload")
	}
	item, err := h.service.UpdateVariant(c.Request().Context(), c.Param("id"), req)
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteVariant(c echo.Context) error {
	item, err := h.service.DeleteVariant(c.Request().Context(), c.Param("id"))
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, item)
}

// ---- shared ------------------------------------------------------------------

func parseProductFilter(c echo.Context) ProductFilter {
	return ProductFilter{
		Q:            c.QueryParam("q"),
		CategoryID:   c.QueryParam("category_id"),
		BrandID:      c.QueryParam("brand_id"),
		Status:       c.QueryParam("status"),
		MinPrice:     queryInt64(c, "min_price"),
		MaxPrice:     queryInt64(c, "max_price"),
		Availability: c.QueryParam("availability"),
		Sort:         c.QueryParam("sort"),
		Page:         queryInt(c, "page", 1),
		Limit:        queryInt(c, "limit", 12),
	}
}

func queryInt(c echo.Context, key string, fallback int) int {
	raw := c.QueryParam(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

func queryInt64(c echo.Context, key string) int64 {
	raw := c.QueryParam(key)
	if raw == "" {
		return 0
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0
	}
	return n
}
