package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"

	sansyarjwt "sansyar/backend/pkg/jwt"
	"sansyar/backend/pkg/requestctx"
)

func Auth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				return echo.ErrUnauthorized
			}

			claims, err := sansyarjwt.Parse(secret, strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				return echo.ErrUnauthorized
			}

			req := c.Request().WithContext(requestctx.WithUser(c.Request().Context(), claims.UserID, claims.Role))
			c.SetRequest(req)
			return next(c)
		}
	}
}

func RequireRoles(roles ...string) echo.MiddlewareFunc {
	allowed := map[string]struct{}{}
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role := requestctx.Role(c.Request().Context())
			if _, ok := allowed[role]; !ok {
				return echo.ErrForbidden
			}
			return next(c)
		}
	}
}
