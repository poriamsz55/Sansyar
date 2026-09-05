package bootstrap

import (
	"context"
	"log/slog"

	"go.mongodb.org/mongo-driver/v2/mongo"

	"sansyar/backend/internal/admin"
	"sansyar/backend/internal/auth"
	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/discovery"
	"sansyar/backend/internal/finance"
	"sansyar/backend/internal/location"
	"sansyar/backend/internal/payment"
	"sansyar/backend/internal/review"
	"sansyar/backend/internal/sport"
	"sansyar/backend/internal/store"
	"sansyar/backend/internal/support"
	"sansyar/backend/internal/upload"
	"sansyar/backend/internal/venue"
	"sansyar/backend/internal/wallet"
	"sansyar/backend/pkg/config"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/logger"
	"sansyar/backend/pkg/sms"
	"sansyar/backend/pkg/storage"
)

type App struct {
	cfg    *config.Config
	db     *mongo.Database
	logger *slog.Logger

	authHandler      *auth.Handler
	sportHandler     *sport.Handler
	locationHandler  *location.Handler
	adminHandler     *admin.Handler
	venueHandler     *venue.Handler
	bookingHandler   *booking.Handler
	paymentHandler   *payment.Handler
	walletHandler    *wallet.Handler
	reviewHandler    *review.Handler
	financeHandler   *finance.Handler
	uploadHandler    *upload.Handler
	discoveryHandler *discovery.Handler
	supportHandler   *support.Handler
	storeHandler     *store.Handler
}

func NewApp(ctx context.Context) (*App, error) {
	cfg := config.Load()
	log := logger.New(cfg.LogLevel)

	db, err := database.ConnectMongoDB(ctx, cfg.MongoURI, cfg.MongoDatabase)
	if err != nil {
		return nil, err
	}

	userRepo := database.NewRepository[auth.User](database.GetCollection(db, "users"))
	otpRepo := database.NewRepository[auth.OTPCode](database.GetCollection(db, "otp_codes"))
	sportRepo := database.NewRepository[sport.Sport](database.GetCollection(db, "sports"))
	provinceRepo := database.NewRepository[location.Province](database.GetCollection(db, "provinces"))
	complexRepo := database.NewRepository[venue.Complex](database.GetCollection(db, "complexes"))
	hallRepo := database.NewRepository[venue.Hall](database.GetCollection(db, "halls"))
	slotRepo := database.NewRepository[venue.Slot](database.GetCollection(db, "time_slots"))
	auditRepo := database.NewRepository[venue.ScheduleAudit](database.GetCollection(db, "audit_logs"))
	bookingRepo := database.NewRepository[booking.Booking](database.GetCollection(db, "bookings"))
	idempotencyRepo := database.NewRepository[booking.IdempotencyRecord](database.GetCollection(db, "idempotency_keys"))
	paymentRepo := database.NewRepository[payment.Payment](database.GetCollection(db, "payments"))
	walletAccountRepo := database.NewRepository[wallet.Account](database.GetCollection(db, "wallet_accounts"))
	walletTransactionRepo := database.NewRepository[wallet.Transaction](database.GetCollection(db, "wallet_transactions"))
	reviewRepo := database.NewRepository[review.Review](database.GetCollection(db, "reviews"))
	ticketRepo := database.NewRepository[support.Ticket](database.GetCollection(db, "support_tickets"))
	storeCategoryRepo := database.NewRepository[store.Category](database.GetCollection(db, "store_categories"))
	storeBrandRepo := database.NewRepository[store.Brand](database.GetCollection(db, "store_brands"))
	storeProductRepo := database.NewRepository[store.Product](database.GetCollection(db, "store_products"))
	storeVariantRepo := database.NewRepository[store.ProductVariant](database.GetCollection(db, "store_product_variants"))
	storeCartRepo := database.NewRepository[store.Cart](database.GetCollection(db, "store_carts"))
	storeAddressRepo := database.NewRepository[store.Address](database.GetCollection(db, "store_addresses"))
	storeOrderRepo := database.NewRepository[store.Order](database.GetCollection(db, "store_orders"))
	storeSettingsRepo := database.NewRepository[store.StoreSettings](database.GetCollection(db, "store_settings"))
	storeOrderPaymentRepo := database.NewRepository[store.OrderPayment](database.GetCollection(db, "store_order_payments"))
	storeInventoryLogRepo := database.NewRepository[store.InventoryLog](database.GetCollection(db, "store_inventory_logs"))
	storeCouponRepo := database.NewRepository[store.Coupon](database.GetCollection(db, "store_coupons"))
	storeCouponUsageRepo := database.NewRepository[store.CouponUsage](database.GetCollection(db, "store_coupon_usage"))

	if err := createIndexes(ctx, db); err != nil {
		return nil, err
	}

	smsSender := sms.NewSender(sms.Config{
		APIKey:   cfg.KavenegarAPIKey,
		Sender:   cfg.KavenegarSender,
		Template: cfg.KavenegarOTPTemplate,
	}, log)

	authService := auth.NewService(userRepo, otpRepo, smsSender, cfg, log)
	sportService := sport.NewService(sportRepo)
	locationService := location.NewService(provinceRepo)
	venueService := venue.NewService(complexRepo, hallRepo, slotRepo, auditRepo)
	adminService := admin.NewService(userRepo, complexRepo, hallRepo, slotRepo, bookingRepo, paymentRepo, sportRepo)
	bookingService := booking.NewService(bookingRepo, slotRepo, idempotencyRepo)
	discoveryService := discovery.NewService(complexRepo, bookingRepo, venueService)
	supportService := support.NewService(ticketRepo)
	storeService := store.NewService(storeCategoryRepo, storeBrandRepo, storeProductRepo, storeVariantRepo, storeCartRepo, storeAddressRepo, storeOrderRepo, storeSettingsRepo, userRepo, storeOrderPaymentRepo, storeInventoryLogRepo, storeCouponRepo, storeCouponUsageRepo)
	financeService := finance.NewService(bookingRepo, slotRepo, complexRepo, paymentRepo, venueService)

	storageService, err := storage.NewService(cfg)
	if err != nil {
		return nil, err
	}

	app := &App{
		cfg:              cfg,
		db:               db,
		logger:           log,
		authHandler:      auth.NewHandler(authService),
		sportHandler:     sport.NewHandler(sportService),
		locationHandler:  location.NewHandler(locationService),
		adminHandler:     admin.NewHandler(adminService),
		venueHandler:     venue.NewHandler(venueService),
		bookingHandler:   booking.NewHandler(bookingService, venueService),
		paymentHandler:   payment.NewHandler(paymentRepo),
		walletHandler:    wallet.NewHandler(walletAccountRepo, walletTransactionRepo),
		reviewHandler:    review.NewHandler(reviewRepo),
		financeHandler:   finance.NewHandler(financeService),
		uploadHandler:    upload.NewHandler(storageService),
		discoveryHandler: discovery.NewHandler(discoveryService),
		supportHandler:   support.NewHandler(supportService),
		storeHandler:     store.NewHandler(storeService),
	}

	// Provinces are reference data the location picker needs in every environment.
	if err := seedProvinces(ctx, provinceRepo); err != nil {
		return nil, err
	}

	if cfg.SeedData {
		if err := seedData(ctx, userRepo, sportRepo, complexRepo, hallRepo, slotRepo); err != nil {
			return nil, err
		}
		if err := seedStoreData(ctx, storeCategoryRepo, storeBrandRepo, storeProductRepo, storeVariantRepo); err != nil {
			return nil, err
		}
	}

	return app, nil
}
