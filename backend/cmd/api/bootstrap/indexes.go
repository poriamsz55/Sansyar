package bootstrap

import (
	"context"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func createIndexes(ctx context.Context, db *mongo.Database) error {
	definitions := map[string][]mongo.IndexModel{
		"users": {
			{Keys: bson.D{{Key: "phone", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "role", Value: 1}}},
			// Vendor admins register with a unique national code; customers have none.
			{Keys: bson.D{{Key: "national_id", Value: 1}}, Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.M{"national_id": bson.M{"$type": "string"}})},
		},
		"otp_codes": {
			{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
		},
		"sports": {
			{Keys: bson.D{{Key: "slug", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
		"complexes": {
			{Keys: bson.D{{Key: "location", Value: "2dsphere"}}},
			{Keys: bson.D{{Key: "owner_id", Value: 1}, {Key: "status", Value: 1}}},
			{Keys: bson.D{{Key: "city", Value: 1}, {Key: "neighborhood", Value: 1}}},
			{Keys: bson.D{{Key: "rating_avg", Value: -1}}},
		},
		"halls": {
			{Keys: bson.D{{Key: "complex_id", Value: 1}, {Key: "is_active", Value: 1}}},
			{Keys: bson.D{{Key: "supported_sport_ids", Value: 1}}},
		},
		"time_slots": {
			{Keys: bson.D{{Key: "hall_id", Value: 1}, {Key: "starts_at", Value: 1}, {Key: "ends_at", Value: 1}}, Options: options.Index().SetUnique(true)},
			{Keys: bson.D{{Key: "complex_id", Value: 1}, {Key: "sport_id", Value: 1}, {Key: "status", Value: 1}, {Key: "starts_at", Value: 1}}},
			{Keys: bson.D{{Key: "final_price", Value: 1}, {Key: "discount_percent", Value: -1}}},
		},
		"bookings": {
			{Keys: bson.D{{Key: "customer_id", Value: 1}, {Key: "status", Value: 1}, {Key: "starts_at", Value: -1}}},
			{Keys: bson.D{{Key: "slot_id", Value: 1}, {Key: "status", Value: 1}}},
			// Multi-capacity sessions accept many bookings, but a single customer
			// may hold only one active booking per session.
			{Keys: bson.D{{Key: "slot_id", Value: 1}, {Key: "customer_id", Value: 1}}, Options: options.Index().SetUnique(true).SetPartialFilterExpression(bson.M{"status": bson.M{"$in": bson.A{"pending", "awaiting_payment", "confirmed"}}})},
		},
		"idempotency_keys": {
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "key", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
		"payments": {
			{Keys: bson.D{{Key: "booking_id", Value: 1}}},
			{Keys: bson.D{{Key: "user_id", Value: 1}, {Key: "created_at", Value: -1}}},
		},
		"wallet_accounts": {
			{Keys: bson.D{{Key: "user_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
		"reviews": {
			{Keys: bson.D{{Key: "complex_id", Value: 1}, {Key: "status", Value: 1}, {Key: "created_at", Value: -1}}},
			{Keys: bson.D{{Key: "booking_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		},
	}

	// Drop the legacy single-capacity booking index so it does not block the new
	// multi-capacity (slot_id + customer_id) uniqueness. Best effort: the index
	// is absent on fresh databases.
	_ = db.Collection("bookings").Indexes().DropOne(ctx, "slot_id_1")

	for collection, models := range definitions {
		if len(models) == 0 {
			continue
		}
		if _, err := db.Collection(collection).Indexes().CreateMany(ctx, models); err != nil {
			return err
		}
	}
	return nil
}
