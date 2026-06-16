package location

import "time"

// Province is one of Iran's 31 provinces (استان). Cities are entered as free
// text by venue owners, so only provinces are persisted as reference data.
type Province struct {
	ID        string    `json:"id" bson:"_id"`
	Name      string    `json:"name" bson:"name"`
	Slug      string    `json:"slug" bson:"slug"`
	Order     int       `json:"order" bson:"order"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

// Provinces is the canonical, ordered list of all 31 Iranian provinces. It is
// seeded into MongoDB on boot and served via GET /provinces.
var Provinces = []struct {
	ID   string
	Name string
	Slug string
}{
	{"province-tehran", "تهران", "tehran"},
	{"province-alborz", "البرز", "alborz"},
	{"province-isfahan", "اصفهان", "isfahan"},
	{"province-fars", "فارس", "fars"},
	{"province-khorasan-razavi", "خراسان رضوی", "khorasan-razavi"},
	{"province-azarbaijan-sharghi", "آذربایجان شرقی", "azarbaijan-sharghi"},
	{"province-azarbaijan-gharbi", "آذربایجان غربی", "azarbaijan-gharbi"},
	{"province-ardabil", "اردبیل", "ardabil"},
	{"province-bushehr", "بوشهر", "bushehr"},
	{"province-chaharmahal-bakhtiari", "چهارمحال و بختیاری", "chaharmahal-bakhtiari"},
	{"province-khorasan-jonubi", "خراسان جنوبی", "khorasan-jonubi"},
	{"province-khorasan-shomali", "خراسان شمالی", "khorasan-shomali"},
	{"province-khuzestan", "خوزستان", "khuzestan"},
	{"province-zanjan", "زنجان", "zanjan"},
	{"province-semnan", "سمنان", "semnan"},
	{"province-sistan-baluchestan", "سیستان و بلوچستان", "sistan-baluchestan"},
	{"province-kordestan", "کردستان", "kordestan"},
	{"province-kerman", "کرمان", "kerman"},
	{"province-kermanshah", "کرمانشاه", "kermanshah"},
	{"province-kohgiluyeh-boyerahmad", "کهگیلویه و بویراحمد", "kohgiluyeh-boyerahmad"},
	{"province-golestan", "گلستان", "golestan"},
	{"province-gilan", "گیلان", "gilan"},
	{"province-lorestan", "لرستان", "lorestan"},
	{"province-mazandaran", "مازندران", "mazandaran"},
	{"province-markazi", "مرکزی", "markazi"},
	{"province-hormozgan", "هرمزگان", "hormozgan"},
	{"province-hamedan", "همدان", "hamedan"},
	{"province-yazd", "یزد", "yazd"},
	{"province-qom", "قم", "qom"},
	{"province-qazvin", "قزوین", "qazvin"},
	{"province-ilam", "ایلام", "ilam"},
}
