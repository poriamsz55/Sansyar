package middleware

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
	"golang.org/x/time/rate"

	"sansyar/backend/pkg/errormap"
)

// RateLimit throttles requests per client IP using an in-memory token bucket.
// It guards the sensitive auth endpoints (login, register, OTP, password reset)
// against brute-force and SMS-bombing. rps is the sustained rate per second and
// burst is the short-term allowance.
func RateLimit(rps float64, burst int) echo.MiddlewareFunc {
	store := echomw.NewRateLimiterMemoryStoreWithConfig(echomw.RateLimiterMemoryStoreConfig{
		Rate:      rate.Limit(rps),
		Burst:     burst,
		ExpiresIn: 3 * time.Minute,
	})
	return echomw.RateLimiterWithConfig(echomw.RateLimiterConfig{
		Store: store,
		IdentifierExtractor: func(c echo.Context) (string, error) {
			return c.RealIP(), nil
		},
		ErrorHandler: func(c echo.Context, err error) error {
			return echo.NewHTTPError(http.StatusInternalServerError, "rate limiter error")
		},
		DenyHandler: func(c echo.Context, identifier string, err error) error {
			return c.JSON(http.StatusTooManyRequests, errormap.ErrorResponse{
				Tag:     "rate_limited",
				Message: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید",
			})
		},
	})
}
