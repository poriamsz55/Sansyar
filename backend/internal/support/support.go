package support

import "time"

const (
	StatusOpen       = "open"
	StatusInProgress = "in_progress"
	StatusResolved   = "resolved"
	StatusClosed     = "closed"

	CategoryContact = "contact"
	CategoryBug     = "bug"
)

type (
	// Ticket is a Contact Us / Report a Bug submission. UserID is populated
	// when the submitter is authenticated, but the create endpoint is public
	// so it stays optional.
	Ticket struct {
		ID         string     `json:"id" bson:"_id"`
		UserID     string     `json:"user_id,omitempty" bson:"user_id,omitempty"`
		Category   string     `json:"category" bson:"category"`
		Name       string     `json:"name,omitempty" bson:"name,omitempty"`
		Phone      string     `json:"phone" bson:"phone"`
		Subject    string     `json:"subject" bson:"subject"`
		Message    string     `json:"message" bson:"message"`
		Status     string     `json:"status" bson:"status"`
		AdminReply string     `json:"admin_reply,omitempty" bson:"admin_reply,omitempty"`
		RepliedAt  *time.Time `json:"replied_at,omitempty" bson:"replied_at,omitempty"`
		CreatedAt  time.Time  `json:"created_at" bson:"created_at"`
		UpdatedAt  time.Time  `json:"updated_at" bson:"updated_at"`
	}

	CreateTicketRequest struct {
		Category string `json:"category"`
		Name     string `json:"name"`
		Phone    string `json:"phone" validate:"required"`
		Subject  string `json:"subject" validate:"required"`
		Message  string `json:"message" validate:"required"`
	}

	TicketFilter struct {
		Status   string
		Category string
		UserID   string
		Page     int
		Limit    int
	}

	PaginatedTickets struct {
		Items []Ticket `json:"items"`
		Total int64    `json:"total"`
		Page  int      `json:"page"`
		Limit int      `json:"limit"`
	}

	UpdateStatusRequest struct {
		Status string `json:"status" validate:"required"`
	}

	ReplyRequest struct {
		Reply string `json:"reply" validate:"required"`
	}
)

func isValidStatus(status string) bool {
	switch status {
	case StatusOpen, StatusInProgress, StatusResolved, StatusClosed:
		return true
	default:
		return false
	}
}
