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
