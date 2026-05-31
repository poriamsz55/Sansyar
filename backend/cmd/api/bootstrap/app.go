package bootstrap

import (
	"context"
	"log/slog"

	"go.mongodb.org/mongo-driver/v2/mongo"

	"sansyar/backend/internal/auth"
	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/finance"
	"sansyar/backend/internal/payment"
	"sansyar/backend/internal/review"
	"sansyar/backend/internal/sport"
	"sansyar/backend/internal/upload"
	"sansyar/backend/internal/venue"
	"sansyar/backend/internal/wallet"
	"sansyar/backend/pkg/config"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/logger"
	"sansyar/backend/pkg/storage"
)

type App struct {
	cfg    *config.Config
	db     *mongo.Database
	logger *slog.Logger

	authHandler    *auth.Handler
	sportHandler   *sport.Handler
	venueHandler   *venue.Handler
	bookingHandler *booking.Handler
	paymentHandler *payment.Handler
	walletHandler  *wallet.Handler
	reviewHandler  *review.Handler
	financeHandler *finance.Handler
	uploadHandler  *upload.Handler
}

func NewApp(ctx context.Context) (*App, error) {
	cfg := config.Load()
	log := logger.New(cfg.LogLevel)

	db, err := database.ConnectMongoDB(ctx, cfg.MongoURI, cfg.MongoDatabase)
	if err != nil {
		return nil, err
	}

	userRepo := database.NewRepository[auth.User](database.GetCollection(db, "users"))
	sportRepo := database.NewRepository[sport.Sport](database.GetCollection(db, "sports"))
	complexRepo := database.NewRepository[venue.Complex](database.GetCollection(db, "complexes"))
	hallRepo := database.NewRepository[venue.Hall](database.GetCollection(db, "halls"))
	slotRepo := database.NewRepository[venue.Slot](database.GetCollection(db, "time_slots"))
	bookingRepo := database.NewRepository[booking.Booking](database.GetCollection(db, "bookings"))
	idempotencyRepo := database.NewRepository[booking.IdempotencyRecord](database.GetCollection(db, "idempotency_keys"))
	paymentRepo := database.NewRepository[payment.Payment](database.GetCollection(db, "payments"))
	walletAccountRepo := database.NewRepository[wallet.Account](database.GetCollection(db, "wallet_accounts"))
	walletTransactionRepo := database.NewRepository[wallet.Transaction](database.GetCollection(db, "wallet_transactions"))
	reviewRepo := database.NewRepository[review.Review](database.GetCollection(db, "reviews"))

	if err := createIndexes(ctx, db); err != nil {
		return nil, err
	}

	authService := auth.NewService(userRepo, cfg, log)
	sportService := sport.NewService(sportRepo)
	venueService := venue.NewService(complexRepo, hallRepo, slotRepo)
	bookingService := booking.NewService(bookingRepo, slotRepo, idempotencyRepo)

	storageService, err := storage.NewService(cfg)
	if err != nil {
		return nil, err
	}

	app := &App{
		cfg:            cfg,
		db:             db,
		logger:         log,
		authHandler:    auth.NewHandler(authService),
		sportHandler:   sport.NewHandler(sportService),
		venueHandler:   venue.NewHandler(venueService),
		bookingHandler: booking.NewHandler(bookingService, venueService),
		paymentHandler: payment.NewHandler(paymentRepo),
		walletHandler:  wallet.NewHandler(walletAccountRepo, walletTransactionRepo),
		reviewHandler:  review.NewHandler(reviewRepo),
		financeHandler: finance.NewHandler(),
		uploadHandler:  upload.NewHandler(storageService),
	}

	if cfg.SeedData {
		if err := seedData(ctx, userRepo, sportRepo, complexRepo, hallRepo, slotRepo); err != nil {
			return nil, err
		}
	}

	return app, nil
}
