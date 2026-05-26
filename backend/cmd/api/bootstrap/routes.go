package bootstrap

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"sansyar/backend/internal/auth"
	sansyarmw "sansyar/backend/pkg/middleware"
)

func (a *App) setupRoutes(e *echo.Echo) {
	e.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	api := e.Group("/api/v1")
	api.GET("/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	api.POST("/auth/register", a.authHandler.Register)
	api.POST("/auth/login", a.authHandler.Login)
	api.POST("/auth/refresh", a.authHandler.Refresh)
	api.POST("/auth/logout", a.authHandler.Logout)

	authenticated := api.Group("", sansyarmw.Auth(a.cfg.JWTSecret))
	authenticated.GET("/me", a.authHandler.Me)

	api.GET("/sports", a.sportHandler.List)
	api.GET("/complexes", a.venueHandler.ListComplexes)
	api.GET("/complexes/:id", a.venueHandler.GetComplex)
	api.GET("/complexes/:complexId/halls", a.venueHandler.ListHalls)
	api.GET("/slots", a.venueHandler.ListSlots)
	api.GET("/halls/:hallId/slots", a.venueHandler.ListSlots)
	api.GET("/map/venues", a.venueHandler.MapVenues)
	api.GET("/complexes/:complexId/reviews", a.reviewHandler.List)

	customer := authenticated.Group("", sansyarmw.RequireRoles(auth.RoleCustomer, auth.RoleSuperAdmin))
	customer.POST("/bookings", a.bookingHandler.Create)
	customer.GET("/my/bookings", a.bookingHandler.MyBookings)
	customer.POST("/bookings/:id/cancel", a.bookingHandler.Cancel)
	customer.POST("/payments/initiate", a.paymentHandler.Initiate)
	customer.POST("/payments/verify", a.paymentHandler.Verify)
	customer.GET("/my/payments", a.paymentHandler.MyPayments)
	customer.GET("/wallet", a.walletHandler.Get)
	customer.GET("/wallet/transactions", a.walletHandler.Transactions)
	customer.POST("/wallet/topup", a.walletHandler.Topup)
	customer.POST("/bookings/:bookingId/reviews", a.reviewHandler.Create)

	api.POST("/payments/webhook", a.paymentHandler.Webhook)

	owner := authenticated.Group("/owner", sansyarmw.RequireRoles(auth.RoleVenueOwner, auth.RoleVenueManager, auth.RoleSuperAdmin))
	owner.POST("/complexes", a.venueHandler.CreateComplex)
	owner.PATCH("/complexes/:id", a.venueHandler.UpdateComplex)
	owner.POST("/complexes/:complexId/halls", a.venueHandler.CreateHall)
	owner.POST("/slots", a.venueHandler.CreateSlot)
	owner.POST("/slots/bulk", a.venueHandler.CreateSlot)
	owner.GET("/bookings", a.bookingHandler.OwnerBookings)
	owner.POST("/bookings/manual", a.bookingHandler.Create)
	owner.GET("/payments", a.paymentHandler.MyPayments)
	owner.POST("/reviews/:id/reply", a.reviewHandler.Reply)
	owner.GET("/finance/summary", a.financeHandler.OwnerSummary)
	owner.GET("/finance/transactions", a.financeHandler.Transactions)

	admin := authenticated.Group("/admin", sansyarmw.RequireRoles(auth.RoleSuperAdmin))
	admin.POST("/sports", a.sportHandler.Create)
	admin.PATCH("/sports/:id", a.sportHandler.Update)
	admin.DELETE("/sports/:id", a.sportHandler.Delete)
	admin.POST("/complexes/:id/approve", a.venueHandler.ApproveComplex)
	admin.POST("/complexes/:id/reject", a.venueHandler.RejectComplex)
	admin.GET("/bookings", a.bookingHandler.AdminBookings)
	admin.POST("/reviews/:id/moderate", a.reviewHandler.Moderate)
	admin.GET("/finance/summary", a.financeHandler.AdminSummary)
	admin.GET("/finance/settlements", a.financeHandler.Settlements)
}
