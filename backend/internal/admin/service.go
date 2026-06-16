package admin

import (
	"context"
	"errors"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"

	"sansyar/backend/internal/auth"
	"sansyar/backend/internal/booking"
	"sansyar/backend/internal/payment"
	"sansyar/backend/internal/sport"
	"sansyar/backend/internal/venue"
	"sansyar/backend/pkg/database"
	"sansyar/backend/pkg/errormap"
)

type Service struct {
	users     *database.Repository[auth.User]
	complexes *database.Repository[venue.Complex]
	halls     *database.Repository[venue.Hall]
	slots     *database.Repository[venue.Slot]
	bookings  *database.Repository[booking.Booking]
	payments  *database.Repository[payment.Payment]
	sports    *database.Repository[sport.Sport]
}

func NewService(
	users *database.Repository[auth.User],
	complexes *database.Repository[venue.Complex],
	halls *database.Repository[venue.Hall],
	slots *database.Repository[venue.Slot],
	bookings *database.Repository[booking.Booking],
	payments *database.Repository[payment.Payment],
	sports *database.Repository[sport.Sport],
) *Service {
	return &Service{users: users, complexes: complexes, halls: halls, slots: slots, bookings: bookings, payments: payments, sports: sports}
}

const maxRead = 2000

// lookups bundles the reference maps used to turn IDs into names.
type lookups struct {
	users    map[string]auth.User
	complex  map[string]venue.Complex
	hall     map[string]venue.Hall
	sport    map[string]string
}

func (s *Service) loadLookups(ctx context.Context) (lookups, error) {
	lk := lookups{users: map[string]auth.User{}, complex: map[string]venue.Complex{}, hall: map[string]venue.Hall{}, sport: map[string]string{}}
	users, err := s.users.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return lk, err
	}
	for _, u := range users {
		lk.users[u.ID] = u
	}
	complexes, err := s.complexes.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return lk, err
	}
	for _, c := range complexes {
		lk.complex[c.ID] = c
	}
	halls, err := s.halls.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return lk, err
	}
	for _, h := range halls {
		lk.hall[h.ID] = h
	}
	sports, err := s.sports.FindAll(ctx, bson.M{}, database.Page{Limit: 500})
	if err != nil {
		return lk, err
	}
	for _, sp := range sports {
		lk.sport[sp.ID] = sp.Name
	}
	return lk, nil
}

func (s *Service) enrich(b booking.Booking, lk lookups) EnrichedBooking {
	u := lk.users[b.CustomerID]
	return EnrichedBooking{
		Booking:       b,
		CustomerName:  u.FullName,
		CustomerPhone: u.Phone,
		ComplexName:   lk.complex[b.ComplexID].Name,
		HallName:      lk.hall[b.HallID].Name,
		SportName:     lk.sport[b.SportID],
	}
}

// ---- Venues (merged complexes + halls) ------------------------------------

func (s *Service) listVenues(ctx context.Context) ([]VenueListItem, error) {
	complexes, err := s.complexes.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return nil, err
	}
	halls, err := s.halls.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	hallsByComplex := map[string][]venue.Hall{}
	for _, h := range halls {
		hallsByComplex[h.ComplexID] = append(hallsByComplex[h.ComplexID], h)
	}
	slots, err := s.slots.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	slotCounts := map[string]int{}
	for _, sl := range slots {
		slotCounts[sl.ComplexID]++
	}
	bookings, err := s.bookings.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	bookingCounts := map[string]int{}
	for _, b := range bookings {
		bookingCounts[b.ComplexID]++
	}
	owners, err := s.userMap(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]VenueListItem, 0, len(complexes))
	for _, c := range complexes {
		owner := owners[c.OwnerID]
		hl := hallsByComplex[c.ID]
		if hl == nil {
			hl = []venue.Hall{}
		}
		items = append(items, VenueListItem{
			Complex:         c,
			OwnerName:       owner.FullName,
			OwnerPhone:      owner.Phone,
			OwnerNationalID: owner.NationalID,
			OwnerAddress:    owner.Address,
			Halls:           hl,
			HallCount:       len(hl),
			SlotCount:       slotCounts[c.ID],
			BookingCount:    bookingCounts[c.ID],
		})
	}
	return items, nil
}

func (s *Service) getVenue(ctx context.Context, id string) (VenueListItem, error) {
	c, err := s.complexes.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return VenueListItem{}, errormap.ErrNotFound
	}
	if err != nil {
		return VenueListItem{}, err
	}
	halls, err := s.halls.FindAll(ctx, bson.M{"complex_id": id}, database.Page{Limit: 200, Sort: bson.D{{Key: "name", Value: 1}}})
	if err != nil {
		return VenueListItem{}, err
	}
	slotCount, _ := s.slots.Count(ctx, bson.M{"complex_id": id})
	bookingCount, _ := s.bookings.Count(ctx, bson.M{"complex_id": id})
	owner, _ := s.users.FindByID(ctx, c.OwnerID)
	return VenueListItem{
		Complex:         c,
		OwnerName:       owner.FullName,
		OwnerPhone:      owner.Phone,
		OwnerNationalID: owner.NationalID,
		OwnerAddress:    owner.Address,
		Halls:           halls,
		HallCount:       len(halls),
		SlotCount:       int(slotCount),
		BookingCount:    int(bookingCount),
	}, nil
}

// ---- Owners ----------------------------------------------------------------

func (s *Service) listOwners(ctx context.Context) ([]OwnerListItem, error) {
	owners, err := s.users.FindAll(ctx, bson.M{"role": bson.M{"$in": bson.A{auth.RoleVenueOwner, auth.RoleVenueManager}}}, database.Page{Limit: maxRead, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return nil, err
	}
	complexes, err := s.complexes.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	venuesByOwner := map[string][]venue.Complex{}
	for _, c := range complexes {
		venuesByOwner[c.OwnerID] = append(venuesByOwner[c.OwnerID], c)
	}

	items := make([]OwnerListItem, 0, len(owners))
	for _, o := range owners {
		ownerComplexes := venuesByOwner[o.ID]
		ids := complexIDs(ownerComplexes)
		var bookingCount int
		last := o.UpdatedAt
		if len(ids) > 0 {
			bks, err := s.bookings.FindAll(ctx, bson.M{"complex_id": bson.M{"$in": ids}}, database.Page{Limit: maxRead})
			if err != nil {
				return nil, err
			}
			bookingCount = len(bks)
			last = latestActivity(last, bks)
		}
		items = append(items, OwnerListItem{User: o, VenueCount: len(ownerComplexes), BookingCount: bookingCount, LastActivityAt: last})
	}
	return items, nil
}

func (s *Service) getOwner(ctx context.Context, id string) (OwnerDetail, error) {
	o, err := s.users.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return OwnerDetail{}, errormap.ErrNotFound
	}
	if err != nil {
		return OwnerDetail{}, err
	}
	venues, err := s.complexes.FindAll(ctx, bson.M{"owner_id": id}, database.Page{Limit: 200, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return OwnerDetail{}, err
	}
	ids := complexIDs(venues)
	var bks []booking.Booking
	if len(ids) > 0 {
		bks, err = s.bookings.FindAll(ctx, bson.M{"complex_id": bson.M{"$in": ids}}, database.Page{Limit: maxRead})
		if err != nil {
			return OwnerDetail{}, err
		}
	}
	return OwnerDetail{
		User:           o,
		Venues:         venues,
		Stats:          computeStats(bks),
		LastActivityAt: latestActivity(o.UpdatedAt, bks),
	}, nil
}

// ---- Customers -------------------------------------------------------------

func (s *Service) listCustomers(ctx context.Context) ([]CustomerListItem, error) {
	customers, err := s.users.FindAll(ctx, bson.M{"role": auth.RoleCustomer}, database.Page{Limit: maxRead, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return nil, err
	}
	bookings, err := s.bookings.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	byCustomer := map[string][]booking.Booking{}
	for _, b := range bookings {
		byCustomer[b.CustomerID] = append(byCustomer[b.CustomerID], b)
	}

	items := make([]CustomerListItem, 0, len(customers))
	for _, c := range customers {
		bks := byCustomer[c.ID]
		cancelled := 0
		for _, b := range bks {
			if isCancelled(b.Status) {
				cancelled++
			}
		}
		items = append(items, CustomerListItem{User: c, BookingCount: len(bks), CancelledCount: cancelled, LastActivityAt: latestActivity(c.UpdatedAt, bks)})
	}
	return items, nil
}

func (s *Service) getCustomer(ctx context.Context, id string) (CustomerDetail, error) {
	c, err := s.users.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return CustomerDetail{}, errormap.ErrNotFound
	}
	if err != nil {
		return CustomerDetail{}, err
	}
	lk, err := s.loadLookups(ctx)
	if err != nil {
		return CustomerDetail{}, err
	}
	bks, err := s.bookings.FindAll(ctx, bson.M{"customer_id": id}, database.Page{Limit: maxRead, Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		return CustomerDetail{}, err
	}

	enriched := make([]EnrichedBooking, 0, len(bks))
	cancellations := make([]EnrichedBooking, 0)
	venueCounts := map[string]int{}
	sportCounts := map[string]int{}
	for _, b := range bks {
		eb := s.enrich(b, lk)
		enriched = append(enriched, eb)
		if isCancelled(b.Status) {
			cancellations = append(cancellations, eb)
		} else {
			venueCounts[b.ComplexID]++
			sportCounts[b.SportID]++
		}
	}

	return CustomerDetail{
		User:           c,
		Bookings:       enriched,
		Cancellations:  cancellations,
		Stats:          computeStats(bks),
		FavoriteVenues: topFavorites(venueCounts, func(id string) string { return lk.complex[id].Name }),
		FavoriteSports: topFavorites(sportCounts, func(id string) string { return lk.sport[id] }),
		LastActivityAt: latestActivity(c.UpdatedAt, bks),
	}, nil
}

// ---- Bookings --------------------------------------------------------------

func (s *Service) listBookings(ctx context.Context, f BookingFilter) (PaginatedBookings, error) {
	lk, err := s.loadLookups(ctx)
	if err != nil {
		return PaginatedBookings{}, err
	}

	filter := bson.M{}
	if f.Status != "" {
		filter["status"] = f.Status
	}
	if f.PaymentStatus != "" {
		filter["payment_status"] = f.PaymentStatus
	}
	if f.ComplexID != "" {
		filter["complex_id"] = f.ComplexID
	}
	if f.CustomerID != "" {
		filter["customer_id"] = f.CustomerID
	}
	if !f.From.IsZero() || !f.To.IsZero() {
		rng := bson.M{}
		if !f.From.IsZero() {
			rng["$gte"] = f.From
		}
		if !f.To.IsZero() {
			rng["$lt"] = f.To
		}
		filter["starts_at"] = rng
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		re := regexp.QuoteMeta(q)
		custIDs := matchUserIDs(lk.users, q)
		cxIDs := matchComplexIDs(lk.complex, q)
		or := bson.A{bson.M{"_id": bson.M{"$regex": re, "$options": "i"}}}
		if len(custIDs) > 0 {
			or = append(or, bson.M{"customer_id": bson.M{"$in": custIDs}})
		}
		if len(cxIDs) > 0 {
			or = append(or, bson.M{"complex_id": bson.M{"$in": cxIDs}})
		}
		filter["$or"] = or
	}

	limit := f.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > maxRead {
		limit = maxRead
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}

	total, err := s.bookings.Count(ctx, filter)
	if err != nil {
		return PaginatedBookings{}, err
	}
	bks, err := s.bookings.FindAll(ctx, filter, database.Page{
		Limit:  int64(limit),
		Offset: int64((page - 1) * limit),
		Sort:   bson.D{{Key: "created_at", Value: -1}},
	})
	if err != nil {
		return PaginatedBookings{}, err
	}
	items := make([]EnrichedBooking, 0, len(bks))
	for _, b := range bks {
		items = append(items, s.enrich(b, lk))
	}
	return PaginatedBookings{Items: items, Total: total, Page: page, Limit: limit}, nil
}

func (s *Service) getBooking(ctx context.Context, id string) (BookingDetail, error) {
	b, err := s.bookings.FindByID(ctx, id)
	if errors.Is(err, database.ErrNotFound) {
		return BookingDetail{}, errormap.ErrNotFound
	}
	if err != nil {
		return BookingDetail{}, err
	}
	lk, err := s.loadLookups(ctx)
	if err != nil {
		return BookingDetail{}, err
	}
	detail := BookingDetail{EnrichedBooking: s.enrich(b, lk)}
	if u, ok := lk.users[b.CustomerID]; ok {
		detail.Customer = &u
	}
	if c, ok := lk.complex[b.ComplexID]; ok {
		detail.Complex = &c
	}
	if h, ok := lk.hall[b.HallID]; ok {
		detail.Hall = &h
	}
	payments, err := s.payments.FindAll(ctx, bson.M{"booking_id": id}, database.Page{Limit: 50, Sort: bson.D{{Key: "created_at", Value: 1}}})
	if err != nil {
		return BookingDetail{}, err
	}
	detail.Payments = payments
	return detail, nil
}

// ---- helpers ---------------------------------------------------------------

func (s *Service) userMap(ctx context.Context) (map[string]auth.User, error) {
	users, err := s.users.FindAll(ctx, bson.M{}, database.Page{Limit: maxRead})
	if err != nil {
		return nil, err
	}
	m := make(map[string]auth.User, len(users))
	for _, u := range users {
		m[u.ID] = u
	}
	return m, nil
}

func complexIDs(items []venue.Complex) []string {
	ids := make([]string, 0, len(items))
	for _, c := range items {
		ids = append(ids, c.ID)
	}
	return ids
}

func isCancelled(status string) bool {
	switch status {
	case booking.StatusCancelledByUser, booking.StatusCancelledByOwner, booking.StatusRefunded, booking.StatusPartiallyRefunded, booking.StatusExpired, booking.StatusNoShow:
		return true
	default:
		return false
	}
}

func computeStats(bks []booking.Booking) BookingStats {
	st := BookingStats{Total: len(bks)}
	for _, b := range bks {
		switch b.Status {
		case booking.StatusConfirmed:
			st.Confirmed++
			st.Revenue += b.FinalAmount
		case booking.StatusCompleted:
			st.Completed++
			st.Revenue += b.FinalAmount
		}
		if isCancelled(b.Status) {
			st.Cancelled++
		}
	}
	return st
}

func latestActivity(base time.Time, bks []booking.Booking) time.Time {
	last := base
	for _, b := range bks {
		if b.CreatedAt.After(last) {
			last = b.CreatedAt
		}
		if b.UpdatedAt.After(last) {
			last = b.UpdatedAt
		}
	}
	return last
}

func topFavorites(counts map[string]int, name func(string) string) []FavoriteStat {
	stats := make([]FavoriteStat, 0, len(counts))
	for id, n := range counts {
		stats = append(stats, FavoriteStat{ID: id, Name: name(id), Count: n})
	}
	sort.Slice(stats, func(i, j int) bool { return stats[i].Count > stats[j].Count })
	if len(stats) > 3 {
		stats = stats[:3]
	}
	return stats
}

func matchUserIDs(users map[string]auth.User, q string) []string {
	q = strings.ToLower(q)
	ids := []string{}
	for id, u := range users {
		if strings.Contains(strings.ToLower(u.FullName), q) || strings.Contains(u.Phone, q) {
			ids = append(ids, id)
		}
	}
	return ids
}

func matchComplexIDs(complexes map[string]venue.Complex, q string) []string {
	q = strings.ToLower(q)
	ids := []string{}
	for id, c := range complexes {
		if strings.Contains(strings.ToLower(c.Name), q) {
			ids = append(ids, id)
		}
	}
	return ids
}
