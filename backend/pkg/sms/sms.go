package sms

import (
	"context"
	"log/slog"
)

type Provider interface {
	Send(ctx context.Context, to string, message string) error
}

type FakeProvider struct {
	logger *slog.Logger
}

func NewFakeProvider(logger *slog.Logger) *FakeProvider {
	return &FakeProvider{logger: logger}
}

func (p *FakeProvider) Send(ctx context.Context, to string, message string) error {
	p.logger.InfoContext(ctx, "fake sms sent", "to", to, "message", message)
	return nil
}
