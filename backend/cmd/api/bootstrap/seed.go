package bootstrap

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/bcrypt"

	"sansyar/backend/internal/auth"
	"sansyar/backend/internal/location"
	"sansyar/backend/internal/sport"
	"sansyar/backend/internal/venue"
	"sansyar/backend/pkg/database"
)

// seedProvinces loads Iran's 31 provinces into MongoDB. It is reference data the
// location picker depends on, so it runs on every boot regardless of SEED_DATA.
func seedProvinces(ctx context.Context, provinces *database.Repository[location.Province]) error {
	count, err := provinces.Collection().CountDocuments(ctx, map[string]any{})
	if err != nil {
		return err
	}
	if int(count) == len(location.Provinces) {
		return nil
	}
	now := time.Now().UTC()
	for i, p := range location.Provinces {
		item := location.Province{ID: p.ID, Name: p.Name, Slug: p.Slug, Order: i + 1, CreatedAt: now, UpdatedAt: now}
		// Upsert keeps existing docs and fills any gaps without duplicating.
		if _, err := provinces.Collection().UpdateByID(ctx, p.ID, map[string]any{"$set": item}, options.UpdateOne().SetUpsert(true)); err != nil {
			return err
		}
	}
	return nil
}

func seedData(ctx context.Context, users *database.Repository[auth.User], sports *database.Repository[sport.Sport], complexes *database.Repository[venue.Complex], halls *database.Repository[venue.Hall], slots *database.Repository[venue.Slot]) error {
	now := time.Now().UTC()

	if count, err := sports.Collection().CountDocuments(ctx, map[string]any{}); err != nil {
		return err
	} else if count == 0 {
		items := []sport.Sport{
			{ID: "sport-futsal", Name: "فوتسال", Slug: "futsal", Icon: "goal", IsActive: true, CreatedAt: now, UpdatedAt: now},
			{ID: "sport-football", Name: "فوتبال", Slug: "football", Icon: "football", IsActive: true, CreatedAt: now, UpdatedAt: now},
			{ID: "sport-volleyball", Name: "والیبال", Slug: "volleyball", Icon: "volleyball", IsActive: true, CreatedAt: now, UpdatedAt: now},
			{ID: "sport-basketball", Name: "بسکتبال", Slug: "basketball", Icon: "basketball", IsActive: true, CreatedAt: now, UpdatedAt: now},
			{ID: "sport-tennis", Name: "تنیس", Slug: "tennis", Icon: "tennis", IsActive: true, CreatedAt: now, UpdatedAt: now},
		}
		for _, item := range items {
			if err := sports.Create(ctx, item); err != nil {
				return err
			}
		}
	}

	if count, err := users.Collection().CountDocuments(ctx, map[string]any{}); err != nil {
		return err
	} else if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("Password123!"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		items := []auth.User{
			{ID: "user-admin", FullName: "مدیر کل", Phone: "09000000000", PasswordHash: string(hash), Role: auth.RoleSuperAdmin, Status: auth.UserStatusActive, CreatedAt: now, UpdatedAt: now},
			{ID: "user-owner", FullName: "مالک مجموعه", FirstName: "مالک", LastName: "مجموعه", NationalID: "0084575948", Address: "تهران، خیابان آزادی", Phone: "09120000000", PasswordHash: string(hash), Role: auth.RoleVenueOwner, Status: auth.UserStatusActive, CreatedAt: now, UpdatedAt: now},
			{ID: "user-customer", FullName: "کاربر نمونه", Phone: "09350000000", PasswordHash: string(hash), Role: auth.RoleCustomer, Status: auth.UserStatusActive, CreatedAt: now, UpdatedAt: now},
		}
		for _, item := range items {
			if err := users.Create(ctx, item); err != nil {
				return err
			}
		}
	}

	if count, err := complexes.Collection().CountDocuments(ctx, map[string]any{}); err != nil {
		return err
	} else if count == 0 {
		complex := venue.Complex{
			ID: "complex-azadi", OwnerID: "user-owner", Name: "مجموعه ورزشی آزادی", Slug: "azadi-sport-complex",
			Description: "رزرو آنلاین سالن های فوتسال، والیبال و بسکتبال با پرداخت امن و قوانین شفاف.",
			City:        "تهران", Address: "تهران، ضلع غربی ورزشگاه آزادی",
			Location:     venue.GeoJSONPoint{Type: "Point", Coordinates: []float64{51.275, 35.724}},
			ContactPhone: "02100000000", ContactLandline: "02100000000", ContactMobile: "09120000000",
			Images: []string{"/images/venues/azadi-1.jpg"}, Amenities: []string{"پارکینگ", "رختکن", "دوش", "بوفه"},
			Rules:              []string{"حضور ۱۵ دقیقه پیش از شروع سانس الزامی است.", "استفاده از کفش مناسب سالن الزامی است."},
			CancellationPolicy: venue.CancellationPolicy{FreeBeforeHours: 24, PartialBeforeHours: 6, PartialRefundPct: 50},
			Status:             venue.ComplexPublished, RatingAvg: 4.7, RatingCount: 128, CreatedAt: now, UpdatedAt: now,
		}
		if err := complexes.Create(ctx, complex); err != nil {
			return err
		}
		hall := venue.Hall{
			ID: "hall-azadi-futsal", ComplexID: complex.ID, Name: "سالن فوتسال شماره ۱",
			SupportedSportIDs: []string{"sport-futsal", "sport-volleyball"}, Capacity: 22, IndoorOutdoor: "indoor",
			FloorType: "پارکت", Dimensions: "40x20", Amenities: []string{"اسکوربرد", "تهویه"}, GenderRule: "all",
			BasePrice: 2500000, Images: []string{"/images/venues/hall-1.jpg"}, Status: venue.HallPublished, IsActive: true, CreatedAt: now, UpdatedAt: now,
		}
		if err := halls.Create(ctx, hall); err != nil {
			return err
		}
		for i := 1; i <= 10; i++ {
			start := now.AddDate(0, 0, 1).Truncate(24 * time.Hour).Add(time.Duration(8+i*2) * time.Hour)
			slot := venue.Slot{
				ID: "slot-azadi-" + time.Unix(int64(i), 0).Format("150405"), HallID: hall.ID, ComplexID: complex.ID, SportID: "sport-futsal",
				StartsAt: start, EndsAt: start.Add(90 * time.Minute), DurationMinutes: 90,
				BasePrice: 2500000, FinalPrice: 2250000, DiscountPercent: 10, BookedCount: 0, Status: venue.SlotAvailable,
				PaymentPolicy: "full_online", MinDepositAmount: 1000000, CancellationPolicySnapshot: complex.CancellationPolicy,
				CreatedBy: "user-owner", CreatedAt: now, UpdatedAt: now,
			}
			if err := slots.Create(ctx, slot); err != nil {
				return err
			}
		}
	}

	return nil
}
