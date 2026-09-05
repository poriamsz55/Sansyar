package bootstrap

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/validator"
)

func RunApp() {
	ctx := context.Background()
	app, err := NewApp(ctx)
	if err != nil {
		log.Fatalf("failed to initialize app: %v", err)
	}
	if err := app.startServer(); err != nil {
		log.Fatalf("server stopped with error: %v", err)
	}
}

func (a *App) NewEcho() *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.Validator = validator.New()
	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}
		if errors.Is(err, echo.ErrUnauthorized) {
			_ = errormap.JSON(c, errormap.ErrUnauthorized)
			return
		}
		if errors.Is(err, echo.ErrForbidden) {
			_ = errormap.JSON(c, errormap.ErrForbidden)
			return
		}
		_ = errormap.JSON(c, err)
	}
	e.Use(echomw.Recover())
	e.Use(echomw.RequestLoggerWithConfig(echomw.RequestLoggerConfig{
		LogURI:    true,
		LogStatus: true,
		LogMethod: true,
		LogValuesFunc: func(c echo.Context, v echomw.RequestLoggerValues) error {
			a.logger.Info("http request", "method", v.Method, "uri", v.URI, "status", v.Status)
			return nil
		},
	}))
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins: a.cfg.CORSOrigins,
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "Idempotency-Key", "X-Cart-Token"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
	}))
	a.setupRoutes(e)
	return e
}

func (a *App) startServer() error {
	e := a.NewEcho()
	errs := make(chan error, 1)
	go func() {
		errs <- e.Start(":" + a.cfg.Port)
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)

	select {
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-quit:
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return e.Shutdown(ctx)
	}
}
