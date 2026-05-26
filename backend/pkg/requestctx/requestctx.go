package requestctx

import "context"

type key string

const (
	userIDKey key = "user_id"
	roleKey   key = "role"
)

func WithUser(ctx context.Context, userID string, role string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	return context.WithValue(ctx, roleKey, role)
}

func UserID(ctx context.Context) string {
	value, _ := ctx.Value(userIDKey).(string)
	return value
}

func Role(ctx context.Context) string {
	value, _ := ctx.Value(roleKey).(string)
	return value
}
