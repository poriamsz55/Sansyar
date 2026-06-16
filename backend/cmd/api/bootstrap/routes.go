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

	// Sensitive auth endpoints are rate limited per IP to blunt brute-force and
	// SMS-bombing.
	authLimit := sansyarmw.RateLimit(1, 8)
	api.POST("/auth/register", a.authHandler.Register, authLimit)
	api.POST("/auth/owner/register", a.authHandler.RegisterOwner, authLimit)
	api.POST("/auth/login", a.authHandler.Login, authLimit)
	api.POST("/auth/password/forgot", a.authHandler.ForgotPassword, authLimit)
	api.POST("/auth/password/reset", a.authHandler.ResetPassword, authLimit)
	api.POST("/auth/otp/request", a.authHandler.RequestOTP, authLimit)
	api.POST("/auth/otp/verify", a.authHandler.VerifyOTP)
	api.POST("/auth/refresh", a.authHandler.Refresh)
	api.POST("/auth/logout", a.authHandler.Logout)

	authenticated := api.Group("", sansyarmw.Auth(a.cfg.JWTSecret))
	authenticated.GET("/me", a.authHandler.Me)

	api.GET("/sports", a.sportHandler.List)
	api.GET("/provinces", a.locationHandler.List)
	api.GET("/complexes", a.venueHandler.ListComplexes)
	api.GET("/complexes/:id", a.venueHandler.GetComplex)
	api.GET("/complexes/:complexId/halls", a.venueHandler.ListHalls)
	api.GET("/halls/:id", a.venueHandler.GetHall)
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

	owner := authenticated.Group("/owner", sansyarmw.RequireRoles(auth.RoleVenueOwner, auth.RoleVenueManager))
	owner.GET("/complexes", a.venueHandler.ListOwnerComplexes)
	owner.POST("/complexes", a.venueHandler.CreateComplex)
	owner.PATCH("/complexes/:id", a.venueHandler.UpdateComplex)
	owner.DELETE("/complexes/:id", a.venueHandler.DeleteComplex)
	owner.GET("/complexes/:complexId/halls", a.venueHandler.ListOwnerHalls)
	owner.POST("/complexes/:complexId/halls", a.venueHandler.CreateHall)
	owner.PATCH("/halls/:id", a.venueHandler.UpdateHall)
	owner.DELETE("/halls/:id", a.venueHandler.DeleteHall)
	owner.POST("/uploads", a.uploadHandler.Upload)
	owner.POST("/slots", a.venueHandler.CreateSlot)
	owner.PATCH("/slots/:id", a.venueHandler.UpdateSlot)
	owner.POST("/slots/bulk", a.venueHandler.CreateSlot)
	// Calendar-based session management.
	owner.GET("/sessions", a.venueHandler.ListSessions)
	owner.POST("/sessions", a.venueHandler.CreateSlot)
	owner.PATCH("/sessions/:id", a.venueHandler.UpdateSlot)
	owner.DELETE("/sessions/:id", a.venueHandler.DeleteSlot)
	owner.POST("/sessions/generate", a.venueHandler.GenerateSessions)
	owner.POST("/sessions/copy-day", a.venueHandler.CopyDay)
	owner.POST("/sessions/duplicate-week", a.venueHandler.DuplicateWeek)
	owner.POST("/sessions/bulk-update", a.venueHandler.BulkUpdateSessions)
	owner.POST("/sessions/block-range", a.venueHandler.BlockRange)
	owner.POST("/sessions/:id/manual-booking", a.bookingHandler.Create)
	owner.GET("/sessions/audit", a.venueHandler.SessionAudit)
	owner.GET("/bookings", a.bookingHandler.OwnerBookings)
	owner.POST("/bookings/manual", a.bookingHandler.Create)
	owner.GET("/payments", a.paymentHandler.MyPayments)
	owner.POST("/reviews/:id/reply", a.reviewHandler.Reply)
	owner.GET("/finance/summary", a.financeHandler.OwnerSummary)
	owner.GET("/finance/transactions", a.financeHandler.Transactions)

	admin := authenticated.Group("/admin", sansyarmw.RequireRoles(auth.RoleSuperAdmin))
	// Aggregated dashboard reads.
	admin.GET("/venues", a.adminHandler.ListVenues)
	admin.GET("/venues/:id", a.adminHandler.GetVenue)
	admin.GET("/owners", a.adminHandler.ListOwners)
	admin.GET("/owners/:id", a.adminHandler.GetOwner)
	admin.GET("/customers", a.adminHandler.ListCustomers)
	admin.GET("/customers/:id", a.adminHandler.GetCustomer)
	admin.GET("/users", a.authHandler.ListUsers)
	admin.POST("/users", a.authHandler.CreateUser)
	admin.PATCH("/users/:id", a.authHandler.UpdateUser)
	admin.DELETE("/users/:id", a.authHandler.SuspendUser)
	admin.GET("/complexes", a.venueHandler.ListAdminComplexes)
	admin.POST("/complexes", a.venueHandler.AdminCreateComplex)
	admin.PATCH("/complexes/:id", a.venueHandler.AdminUpdateComplex)
	admin.DELETE("/complexes/:id", a.venueHandler.AdminDeleteComplex)
	admin.POST("/complexes/:id/approve", a.venueHandler.ApproveComplex)
	admin.POST("/complexes/:id/reject", a.venueHandler.RejectComplex)
	admin.POST("/complexes/:id/publish", a.venueHandler.PublishComplex)
	admin.POST("/complexes/:id/unpublish", a.venueHandler.UnpublishComplex)
	admin.GET("/halls", a.venueHandler.ListAdminHalls)
	admin.PATCH("/halls/:id", a.venueHandler.AdminUpdateHall)
	admin.DELETE("/halls/:id", a.venueHandler.AdminDeleteHall)
	admin.POST("/halls/:id/approve", a.venueHandler.ApproveHall)
	admin.POST("/halls/:id/reject", a.venueHandler.RejectHall)
	admin.POST("/halls/:id/publish", a.venueHandler.PublishHall)
	admin.POST("/halls/:id/unpublish", a.venueHandler.UnpublishHall)
	admin.POST("/uploads", a.uploadHandler.Upload)
	admin.POST("/sports", a.sportHandler.Create)
	admin.PATCH("/sports/:id", a.sportHandler.Update)
	admin.DELETE("/sports/:id", a.sportHandler.Delete)
	admin.GET("/bookings", a.adminHandler.ListBookings)
	admin.GET("/bookings/:id", a.adminHandler.GetBooking)
	admin.POST("/bookings/:id/cancel", a.bookingHandler.AdminCancel)
	admin.POST("/bookings/:id/confirm", a.bookingHandler.AdminConfirm)
	admin.POST("/reviews/:id/moderate", a.reviewHandler.Moderate)
	admin.GET("/finance/summary", a.financeHandler.AdminSummary)
	admin.GET("/finance/settlements", a.financeHandler.Settlements)
}
