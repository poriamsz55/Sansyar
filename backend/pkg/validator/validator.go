package validator

import "github.com/go-playground/validator/v10"

type EchoValidator struct {
	validate *validator.Validate
}

func New() *EchoValidator {
	return &EchoValidator{validate: validator.New()}
}

func (v *EchoValidator) Validate(i any) error {
	return v.validate.Struct(i)
}
