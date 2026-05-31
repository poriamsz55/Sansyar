package rbac

import (
	"context"

	"sansyar/backend/internal/auth"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

func IsSuperAdmin(ctx context.Context) bool {
	return requestctx.Role(ctx) == auth.RoleSuperAdmin
}

func RequireOwnerOrAdmin(ctx context.Context, resourceOwnerID, actorID string) error {
	if IsSuperAdmin(ctx) {
		return nil
	}
	if resourceOwnerID != actorID {
		return errormap.ErrForbidden
	}
	return nil
}
