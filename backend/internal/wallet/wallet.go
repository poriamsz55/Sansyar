package wallet

import "time"

type (
	Account struct {
		ID        string    `json:"id" bson:"_id"`
		UserID    string    `json:"user_id" bson:"user_id"`
		Balance   int64     `json:"balance" bson:"balance"`
		Currency  string    `json:"currency" bson:"currency"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	}

	Transaction struct {
		ID        string    `json:"id" bson:"_id"`
		UserID    string    `json:"user_id" bson:"user_id"`
		Type      string    `json:"type" bson:"type"`
		Amount    int64     `json:"amount" bson:"amount"`
		Reference string    `json:"reference" bson:"reference"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
	}
)
