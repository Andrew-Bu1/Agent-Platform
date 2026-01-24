package config

import (
	"log/slog"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port 		 int
	DatabaseURL  string
	RedisURL     string
	
	AIHubURL     string
	AIHubAPIKey  string
	LogLevel     string
}

func LoadConfig() *Config {

	if err := godotenv.Load(); err != nil {
		slog.Warn("Error loading .env file, using environment variables", "error", err)
	}
	

	cfg := &Config{
		Port: 	     getEnvAsInt("PORT", 8080),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		RedisURL:    getEnv("REDIS_URL", ""),
		AIHubURL:    getEnv("AI_HUB_URL", ""),
		AIHubAPIKey: getEnv("AI_HUB_API_KEY", ""),
		LogLevel:    getEnv("LOG_LEVEL", "INFO"),
	}	
		
	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		slog.Warn("Invalid integer environment variable, using default", "key", key, "value", valueStr)
		return defaultValue
	}

	return value
}