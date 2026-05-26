package errormap

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
	ErrInvalidInput = errors.New("invalid input")
)

type ErrorResponse struct {
	Tag        string `json:"tag"`
	Message    string `json:"message"`
	DebugError string `json:"debug_error,omitempty"`
}

func JSON(c echo.Context, err error) error {
	status, tag, message := classify(err)
	return c.JSON(status, ErrorResponse{Tag: tag, Message: message})
}

func Input(c echo.Context, message string) error {
	return c.JSON(http.StatusBadRequest, ErrorResponse{Tag: "input", Message: message})
}

func classify(err error) (int, string, string) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		return http.StatusBadRequest, "input", err.Error()
	case errors.Is(err, ErrUnauthorized):
		return http.StatusUnauthorized, "auth", "Unauthorized"
	case errors.Is(err, ErrForbidden):
		return http.StatusForbidden, "permission", "Forbidden"
	case errors.Is(err, ErrNotFound):
		return http.StatusNotFound, "not_found", "Resource not found"
	case errors.Is(err, ErrConflict):
		return http.StatusConflict, "conflict", err.Error()
	default:
		return http.StatusInternalServerError, "internal", "Internal server error"
	}
}
