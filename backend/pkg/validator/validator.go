package validator

import (
	"regexp"
	"strings"
	"unicode"

	"github.com/go-playground/validator/v10"
)

type EchoValidator struct {
	validate *validator.Validate
}

var (
	iranMobileRe = regexp.MustCompile(`^09\d{9}$`)
	// Iranian landline: leading 0, area code (second digit 1-8 — 09 is mobile,
	// 00 is an international prefix), then the subscriber number; 11 digits total.
	iranLandlineRe = regexp.MustCompile(`^0[1-8]\d{9}$`)
	asciiDigitMap  = map[rune]rune{
		'۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
		'٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
	}
)

func New() *EchoValidator {
	v := validator.New()
	// Custom domain validators shared by every DTO. Registration failures here
	// are surfaced to the client as input errors by the handlers.
	_ = v.RegisterValidation("irmobile", validateIranMobile)
	_ = v.RegisterValidation("irlandline", validateIranLandline)
	_ = v.RegisterValidation("irnationalcode", validateIranNationalCode)
	_ = v.RegisterValidation("strongpassword", validateStrongPassword)
	return &EchoValidator{validate: v}
}

func (v *EchoValidator) Validate(i any) error {
	return v.validate.Struct(i)
}

func validateIranMobile(fl validator.FieldLevel) bool {
	return IsIranMobile(fl.Field().String())
}

func validateIranLandline(fl validator.FieldLevel) bool {
	return IsIranLandline(fl.Field().String())
}

// ToASCIIDigits converts Persian/Arabic-Indic digits to ASCII 0-9 and strips
// every other character. Use it to sanitize phone input before validation.
func ToASCIIDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if a, ok := asciiDigitMap[r]; ok {
			b.WriteRune(a)
		} else if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// NormalizeIranMobile sanitizes and canonicalizes an Iranian mobile number to
// 09XXXXXXXXX. It accepts 09…, +989…, 00989…, and bare 9… forms. An empty input
// is valid and returns "". The bool reports whether the (non-empty) input was a
// well-formed mobile number.
func NormalizeIranMobile(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", true
	}
	digits := ToASCIIDigits(strings.ReplaceAll(trimmed, "+", ""))
	switch {
	case strings.HasPrefix(digits, "0098"):
		digits = "0" + digits[4:]
	case strings.HasPrefix(digits, "98") && len(digits) == 12:
		digits = "0" + digits[2:]
	case strings.HasPrefix(digits, "9") && len(digits) == 10:
		digits = "0" + digits
	}
	if IsIranMobile(digits) {
		return digits, true
	}
	return "", false
}

// NormalizeIranLandline sanitizes and canonicalizes an Iranian landline to its
// 11-digit form with leading-0 area code. It accepts +98 / 0098 prefixes. An
// empty input is valid and returns "".
func NormalizeIranLandline(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", true
	}
	digits := ToASCIIDigits(strings.ReplaceAll(trimmed, "+", ""))
	switch {
	case strings.HasPrefix(digits, "0098"):
		digits = "0" + digits[4:]
	case strings.HasPrefix(digits, "98") && len(digits) == 12:
		digits = "0" + digits[2:]
	}
	if IsIranLandline(digits) {
		return digits, true
	}
	return "", false
}

// IsIranLandline reports whether s is a canonical Iranian landline number.
func IsIranLandline(s string) bool {
	return iranLandlineRe.MatchString(s)
}

func validateIranNationalCode(fl validator.FieldLevel) bool {
	return IsIranNationalCode(fl.Field().String())
}

func validateStrongPassword(fl validator.FieldLevel) bool {
	return IsStrongPassword(fl.Field().String())
}

// IsIranMobile reports whether s is a valid Iranian mobile number (09XXXXXXXXX).
func IsIranMobile(s string) bool {
	return iranMobileRe.MatchString(s)
}

// IsIranNationalCode validates an Iranian national code (کد ملی): exactly ten
// digits passing the official check-digit algorithm. Repeated-digit codes such
// as "0000000000" are rejected.
func IsIranNationalCode(code string) bool {
	if len(code) != 10 {
		return false
	}
	for _, r := range code {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	allSame := true
	for i := 1; i < 10; i++ {
		if code[i] != code[0] {
			allSame = false
			break
		}
	}
	if allSame {
		return false
	}
	sum := 0
	for i := 0; i < 9; i++ {
		sum += int(code[i]-'0') * (10 - i)
	}
	check := int(code[9] - '0')
	rem := sum % 11
	if rem < 2 {
		return check == rem
	}
	return check == 11-rem
}

// IsStrongPassword requires at least eight characters containing both a letter
// and a digit.
func IsStrongPassword(s string) bool {
	if len(s) < 8 {
		return false
	}
	var hasLetter, hasDigit bool
	for _, r := range s {
		switch {
		case unicode.IsLetter(r):
			hasLetter = true
		case unicode.IsDigit(r):
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}
