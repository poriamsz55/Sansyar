package sms

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/kavenegar/kavenegar-go"
)

// OTPSender delivers a one-time verification code to a phone number.
type OTPSender interface {
	SendOTP(ctx context.Context, phone string, code string) error
}

// Config holds the Kavenegar credentials and OTP delivery settings.
type Config struct {
	APIKey   string
	Sender   string
	Template string
}

// NewSender returns a Kavenegar-backed sender when an API key is configured,
// otherwise a FakeProvider that only logs the code (handy for local dev until
// the real credentials are filled in).
func NewSender(cfg Config, logger *slog.Logger) OTPSender {
	if cfg.APIKey == "" {
		logger.Warn("kavenegar api key not set; using fake sms provider (codes are logged, not sent)")
		return NewFakeProvider(logger)
	}
	return NewKavenegarProvider(cfg, logger)
}

// FakeProvider logs the OTP instead of sending it. Used when no SMS provider is
// configured so the local OTP flow still works end to end.
type FakeProvider struct {
	logger *slog.Logger
}

func NewFakeProvider(logger *slog.Logger) *FakeProvider {
	return &FakeProvider{logger: logger}
}

func (p *FakeProvider) SendOTP(ctx context.Context, phone string, code string) error {
	p.logger.InfoContext(ctx, "fake sms: otp code", "to", phone, "code", code)
	return nil
}

// KavenegarProvider sends OTPs through Kavenegar. When a Verify/Lookup template
// is configured it uses the dedicated OTP API (recommended); otherwise it falls
// back to a plain SMS sent from the configured sender line.
type KavenegarProvider struct {
	api      *kavenegar.Kavenegar
	sender   string
	template string
	logger   *slog.Logger
}

func NewKavenegarProvider(cfg Config, logger *slog.Logger) *KavenegarProvider {
	return &KavenegarProvider{
		api:      kavenegar.New(cfg.APIKey),
		sender:   cfg.Sender,
		template: cfg.Template,
		logger:   logger,
	}
}

func (p *KavenegarProvider) SendOTP(ctx context.Context, phone string, code string) error {
	if p.template != "" {
		if _, err := p.api.Verify.Lookup(phone, p.template, code, nil); err != nil {
			return p.wrap(err)
		}
		return nil
	}

	message := fmt.Sprintf("کد تایید سانسیار: %s", code)
	if _, err := p.api.Message.Send(p.sender, []string{phone}, message, nil); err != nil {
		return p.wrap(err)
	}
	return nil
}

func (p *KavenegarProvider) wrap(err error) error {
	switch e := err.(type) {
	case *kavenegar.APIError:
		return fmt.Errorf("kavenegar api error: %w", e)
	case *kavenegar.HTTPError:
		return fmt.Errorf("kavenegar http error: %w", e)
	default:
		return fmt.Errorf("kavenegar send failed: %w", err)
	}
}
