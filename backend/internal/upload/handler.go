package upload

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/storage"
)

const maxUploadSize = 10 << 20 // 10 MB

type Handler struct {
	storage *storage.Service
}

func NewHandler(storage *storage.Service) *Handler {
	return &Handler{storage: storage}
}

type UploadResponse struct {
	URL string `json:"url"`
}

func (h *Handler) Upload(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return errormap.Input(c, "file is required")
	}
	if file.Size > maxUploadSize {
		return errormap.Input(c, "file exceeds 10MB limit")
	}

	src, err := file.Open()
	if err != nil {
		return errormap.JSON(c, err)
	}
	defer src.Close()

	contentType := file.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType([]byte(file.Filename))
	}

	folder := c.FormValue("folder")
	if folder == "" {
		folder = "uploads"
	}
	folder = strings.Trim(folder, "/")

	url, err := h.storage.Upload(c.Request().Context(), src, file.Size, contentType, folder)
	if err != nil {
		return errormap.Input(c, err.Error())
	}

	return c.JSON(http.StatusCreated, UploadResponse{URL: url})
}
