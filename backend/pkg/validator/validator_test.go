package validator

import "testing"

func TestIsIranNationalCode(t *testing.T) {
	tests := []struct {
		code string
		want bool
	}{
		{"0084575948", true},  // valid check digit
		{"0499370899", true},  // valid check digit
		{"0000000000", false}, // all-same digits rejected
		{"1111111111", false}, // all-same digits rejected
		{"123456789", false},  // too short
		{"12345678901", false},
		{"123456789a", false}, // non-digit
		{"0084575941", false}, // wrong check digit
	}
	for _, tt := range tests {
		if got := IsIranNationalCode(tt.code); got != tt.want {
			t.Errorf("IsIranNationalCode(%q) = %v, want %v", tt.code, got, tt.want)
		}
	}
}

func TestIsIranMobile(t *testing.T) {
	valid := []string{"09120000000", "09350000001"}
	invalid := []string{"9120000000", "0912000000", "081200000000", "+989120000000", "abcd"}
	for _, v := range valid {
		if !IsIranMobile(v) {
			t.Errorf("IsIranMobile(%q) = false, want true", v)
		}
	}
	for _, v := range invalid {
		if IsIranMobile(v) {
			t.Errorf("IsIranMobile(%q) = true, want false", v)
		}
	}
}

func TestIsIranLandline(t *testing.T) {
	valid := []string{"02112345678", "04133334444", "07136660000"}
	invalid := []string{"09120000000", "2112345678", "0211234567", "00211234567", "abcd"}
	for _, v := range valid {
		if !IsIranLandline(v) {
			t.Errorf("IsIranLandline(%q) = false, want true", v)
		}
	}
	for _, v := range invalid {
		if IsIranLandline(v) {
			t.Errorf("IsIranLandline(%q) = true, want false", v)
		}
	}
}

func TestNormalizeIranMobile(t *testing.T) {
	cases := []struct {
		in  string
		out string
		ok  bool
	}{
		{"", "", true},
		{"09120000000", "09120000000", true},
		{"+989120000000", "09120000000", true},
		{"00989120000000", "09120000000", true},
		{"9120000000", "09120000000", true},
		{"۰۹۱۲۰۰۰۰۰۰۰", "09120000000", true},
		{"0912000", "", false},
	}
	for _, c := range cases {
		got, ok := NormalizeIranMobile(c.in)
		if got != c.out || ok != c.ok {
			t.Errorf("NormalizeIranMobile(%q) = (%q,%v), want (%q,%v)", c.in, got, ok, c.out, c.ok)
		}
	}
}

func TestNormalizeIranLandline(t *testing.T) {
	cases := []struct {
		in  string
		out string
		ok  bool
	}{
		{"", "", true},
		{"02112345678", "02112345678", true},
		{"+982112345678", "02112345678", true},
		{"۰۲۱۱۲۳۴۵۶۷۸", "02112345678", true},
		{"123", "", false},
	}
	for _, c := range cases {
		got, ok := NormalizeIranLandline(c.in)
		if got != c.out || ok != c.ok {
			t.Errorf("NormalizeIranLandline(%q) = (%q,%v), want (%q,%v)", c.in, got, ok, c.out, c.ok)
		}
	}
}

func TestIsStrongPassword(t *testing.T) {
	if !IsStrongPassword("Password123") {
		t.Error("expected Password123 to be strong")
	}
	weak := []string{"short1", "allletters", "12345678"}
	for _, w := range weak {
		if IsStrongPassword(w) {
			t.Errorf("expected %q to be weak", w)
		}
	}
}
