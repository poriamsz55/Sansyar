package database

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var (
	ErrNotFound  = errors.New("document not found")
	ErrInvalidID = errors.New("invalid id")
)

func ConnectMongoDB(ctx context.Context, uri string, dbName string) (*mongo.Database, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := client.Ping(pingCtx, nil); err != nil {
		return nil, err
	}

	return client.Database(dbName), nil
}

func GetCollection(db *mongo.Database, name string) *mongo.Collection {
	return db.Collection(name)
}
