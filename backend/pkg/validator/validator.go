package validator

import (
	"regexp"
	"unicode"

	"github.com/go-playground/validator/v10"
)

type EchoValidator struct {
	validate *validator.Validate
}

var iranMobileRe = regexp.MustCompile(`^09\d{9}$`)

func New() *EchoValidator {
	v := validator.New()
	// Custom domain validators shared by every DTO. Registration failures here
	// are surfaced to the client as input errors by the handlers.
	_ = v.RegisterValidation("irmobile", validateIranMobile)
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
