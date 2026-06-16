package venue

import (
	"context"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
)

// ScheduleAudit is an immutable record of a change a venue owner made to their
// schedule. It powers the "history of changes" drawer and gives the platform a
// trail for sensitive operational actions.
type ScheduleAudit struct {
	ID        string    `json:"id" bson:"_id"`
	ActorID   string    `json:"actor_id" bson:"actor_id"`
	ComplexID string    `json:"complex_id" bson:"complex_id"`
	HallID    string    `json:"hall_id" bson:"hall_id"`
	SlotID    string    `json:"slot_id,omitempty" bson:"slot_id,omitempty"`
	Action    string    `json:"action" bson:"action"`
	Details   string    `json:"details,omitempty" bson:"details,omitempty"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
}

// audit records a schedule change. Failures are swallowed: an audit write must
// never block the operational action it describes.
func (s *Service) audit(ctx context.Context, actorID, complexID, hallID, slotID, action, details string) {
	if s.audits == nil {
		return
	}
	_ = s.audits.Create(ctx, ScheduleAudit{
		ID:        uuid.NewString(),
		ActorID:   actorID,
		ComplexID: complexID,
		HallID:    hallID,
		SlotID:    slotID,
		Action:    action,
		Details:   details,
		CreatedAt: time.Now().UTC(),
	})
}

// listAudit returns recent schedule changes for an owner, optionally scoped to a
// single hall.
func (s *Service) listAudit(ctx context.Context, ownerID, hallID string) ([]ScheduleAudit, error) {
	ids, err := s.complexIDsForOwner(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	filter := bson.M{"complex_id": bson.M{"$in": ids}}
	if hallID != "" {
		filter["hall_id"] = hallID
	}
	return s.audits.FindAll(ctx, filter, database.Page{Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}}})
}
