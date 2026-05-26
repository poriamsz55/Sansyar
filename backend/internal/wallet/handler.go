package wallet

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
	"sansyar/backend/pkg/requestctx"
)

type Handler struct {
	accounts     *database.Repository[Account]
	transactions *database.Repository[Transaction]
}

func NewHandler(accounts *database.Repository[Account], transactions *database.Repository[Transaction]) *Handler {
	return &Handler{accounts: accounts, transactions: transactions}
}

func (h *Handler) Get(c echo.Context) error {
	userID := requestctx.UserID(c.Request().Context())
	account, err := h.accounts.FindOne(c.Request().Context(), bson.M{"user_id": userID})
	if err == nil {
		return c.JSON(http.StatusOK, account)
	}
	now := time.Now().UTC()
	account = Account{ID: uuid.NewString(), UserID: userID, Balance: 0, Currency: "IRR", CreatedAt: now, UpdatedAt: now}
	if err := h.accounts.Create(c.Request().Context(), account); err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, account)
}

func (h *Handler) Transactions(c echo.Context) error {
	items, err := h.transactions.FindAll(c.Request().Context(), bson.M{"user_id": requestctx.UserID(c.Request().Context())}, database.Page{Limit: 100, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return errormap.JSON(c, err)
	}
	return c.JSON(http.StatusOK, items)
}

func (h *Handler) Topup(c echo.Context) error {
	return c.JSON(http.StatusAccepted, map[string]string{"status": "payment_required", "message": "wallet topup uses the payment provider abstraction"})
}
