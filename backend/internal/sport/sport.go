package sport

import "time"

type (
	Sport struct {
		ID        string    `json:"id" bson:"_id"`
		Name      string    `json:"name" bson:"name"`
		Slug      string    `json:"slug" bson:"slug"`
		Icon      string    `json:"icon" bson:"icon"`
		IsActive  bool      `json:"is_active" bson:"is_active"`
		CreatedAt time.Time `json:"created_at" bson:"created_at"`
		UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	}

	CreateSportRequest struct {
		Name string `json:"name" validate:"required"`
		Slug string `json:"slug" validate:"required"`
		Icon string `json:"icon"`
	}

	UpdateSportRequest struct {
		Name     string `json:"name"`
		Slug     string `json:"slug"`
		Icon     string `json:"icon"`
		IsActive *bool  `json:"is_active"`
	}
)
