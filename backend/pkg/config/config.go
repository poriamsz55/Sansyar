package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppName        string
	Env            string
	Port           string
	MongoURI       string
	MongoDatabase  string
	JWTSecret          string
	AccessTokenTTL     time.Duration
	RememberMeTokenTTL time.Duration
	LoginMaxAttempts   int
	LoginLockDuration  time.Duration
	CORSOrigins        []string
	SeedData       bool
	LogLevel       string
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	MinIOUseSSL    bool
	MinIOPublicURL string

	KavenegarAPIKey      string
	KavenegarSender      string
	KavenegarOTPTemplate string

	OTPCodeLength     int
	OTPTTL            time.Duration
	OTPMaxAttempts    int
	OTPResendCooldown time.Duration
	OTPDemoPhone      string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		AppName:        env("APP_NAME", "Sansyar"),
		Env:            env("APP_ENV", "development"),
		Port:           env("PORT", "8080"),
		MongoURI:       env("MONGO_URI", "mongodb://localhost:27017"),
		MongoDatabase:  env("MONGO_DATABASE", "sansyar"),
		JWTSecret:          env("JWT_SECRET", "change-me-in-production"),
		AccessTokenTTL:     durationEnv("ACCESS_TOKEN_TTL", 24*time.Hour),
		RememberMeTokenTTL: durationEnv("REMEMBER_ME_TOKEN_TTL", 720*time.Hour),
		LoginMaxAttempts:   intEnv("LOGIN_MAX_ATTEMPTS", 5),
		LoginLockDuration:  durationEnv("LOGIN_LOCK_DURATION", 15*time.Minute),
		CORSOrigins:        listEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"),
		SeedData:       boolEnv("SEED_DATA", false),
		LogLevel:       env("LOG_LEVEL", "info"),
		MinIOEndpoint:  env("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey: env("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey: env("MINIO_SECRET_KEY", "minioadmin"),
		MinIOBucket:    env("MINIO_BUCKET", "sansyar"),
		MinIOUseSSL:    boolEnv("MINIO_USE_SSL", false),
		MinIOPublicURL: env("MINIO_PUBLIC_URL", "http://localhost:9000/sansyar"),

		KavenegarAPIKey:      env("KAVENEGAR_API_KEY", ""),
		KavenegarSender:      env("KAVENEGAR_SENDER", "2000660110"),
		KavenegarOTPTemplate: env("KAVENEGAR_OTP_TEMPLATE", ""),

		OTPCodeLength:     intEnv("OTP_CODE_LENGTH", 5),
		OTPTTL:            durationEnv("OTP_TTL", 2*time.Minute),
		OTPMaxAttempts:    intEnv("OTP_MAX_ATTEMPTS", 5),
		OTPResendCooldown: durationEnv("OTP_RESEND_COOLDOWN", 60*time.Second),
		OTPDemoPhone:      env("OTP_DEMO_PHONE", "09350000000"),
	}
}

func env(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func listEnv(key string, fallback string) []string {
	raw := env(key, fallback)
	parts := strings.Split(raw, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func intEnv(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func boolEnv(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err == nil {
		return value
	}
	hours, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return time.Duration(hours) * time.Hour
}
