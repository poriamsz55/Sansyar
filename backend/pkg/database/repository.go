package database

import (
	"context"
	"errors"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type Repository[T any] struct {
	collection *mongo.Collection
}

type Page struct {
	Limit  int64
	Offset int64
	Sort   any
}

func NewRepository[T any](collection *mongo.Collection) *Repository[T] {
	return &Repository[T]{collection: collection}
}

func (r *Repository[T]) Collection() *mongo.Collection {
	return r.collection
}

func (r *Repository[T]) Create(ctx context.Context, doc T) error {
	_, err := r.collection.InsertOne(ctx, doc)
	return err
}

func (r *Repository[T]) FindByID(ctx context.Context, id string) (T, error) {
	var result T
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&result)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return result, ErrNotFound
	}
	return result, err
}

func (r *Repository[T]) FindOne(ctx context.Context, filter any) (T, error) {
	var result T
	err := r.collection.FindOne(ctx, filter).Decode(&result)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return result, ErrNotFound
	}
	return result, err
}

func (r *Repository[T]) FindAll(ctx context.Context, filter any, page Page) ([]T, error) {
	opts := options.Find()
	if page.Limit > 0 {
		opts.SetLimit(page.Limit)
	}
	if page.Offset > 0 {
		opts.SetSkip(page.Offset)
	}
	if page.Sort != nil {
		opts.SetSort(page.Sort)
	}

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var results []T
	if err := cursor.All(ctx, &results); err != nil {
		return nil, err
	}
	if results == nil {
		return []T{}, nil
	}
	return results, nil
}

func (r *Repository[T]) Update(ctx context.Context, id string, update any) error {
	result, err := r.collection.UpdateByID(ctx, id, update)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository[T]) Count(ctx context.Context, filter any) (int64, error) {
	return r.collection.CountDocuments(ctx, filter)
}

func (r *Repository[T]) Delete(ctx context.Context, id string) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}
