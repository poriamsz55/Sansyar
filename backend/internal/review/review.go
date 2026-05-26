package review

import "time"

type Review struct {
	ID         string    `json:"id" bson:"_id"`
	BookingID  string    `json:"booking_id" bson:"booking_id"`
	ComplexID  string    `json:"complex_id" bson:"complex_id"`
	CustomerID string    `json:"customer_id" bson:"customer_id"`
	Rating     int       `json:"rating" bson:"rating"`
	Comment    string    `json:"comment" bson:"comment"`
	OwnerReply string    `json:"owner_reply,omitempty" bson:"owner_reply,omitempty"`
	Status     string    `json:"status" bson:"status"`
	Helpful    int       `json:"helpful" bson:"helpful"`
	CreatedAt  time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" bson:"updated_at"`
}
