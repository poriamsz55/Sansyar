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
	JWTSecret      string
	AccessTokenTTL time.Duration
	CORSOrigins    []string
	SeedData       bool
	LogLevel       string
	MinIOEndpoint  string
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	MinIOUseSSL    bool
	MinIOPublicURL string
}

func Load() *Config {
	_ = godotenv.Load()

	return &Config{
		AppName:        env("APP_NAME", "Sansyar"),
		Env:            env("APP_ENV", "development"),
		Port:           env("PORT", "8080"),
		MongoURI:       env("MONGO_URI", "mongodb://localhost:27017"),
		MongoDatabase:  env("MONGO_DATABASE", "sansyar"),
		JWTSecret:      env("JWT_SECRET", "change-me-in-production"),
		AccessTokenTTL: durationEnv("ACCESS_TOKEN_TTL", 24*time.Hour),
		CORSOrigins:    listEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174"),
		SeedData:       boolEnv("SEED_DATA", false),
		LogLevel:       env("LOG_LEVEL", "info"),
		MinIOEndpoint:  env("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey: env("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey: env("MINIO_SECRET_KEY", "minioadmin"),
		MinIOBucket:    env("MINIO_BUCKET", "sansyar"),
		MinIOUseSSL:    boolEnv("MINIO_USE_SSL", false),
		MinIOPublicURL: env("MINIO_PUBLIC_URL", "http://localhost:9000/sansyar"),
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
