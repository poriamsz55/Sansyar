package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"

	sansyarjwt "sansyar/backend/pkg/jwt"
	"sansyar/backend/pkg/requestctx"
)

// OptionalAuth attaches the user to the request context when a valid bearer
// token is present and continues anonymously otherwise. Used by endpoints
// that serve both guests and authenticated users (e.g. the store cart).
func OptionalAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				return next(c)
			}

			claims, err := sansyarjwt.Parse(secret, strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				// An invalid token on an optional-auth route is treated as
				// anonymous rather than a hard failure.
				return next(c)
			}

			req := c.Request().WithContext(requestctx.WithUser(c.Request().Context(), claims.UserID, claims.Role))
			c.SetRequest(req)
			return next(c)
		}
	}
}
