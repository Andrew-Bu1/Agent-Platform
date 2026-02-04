package common

import (
	"os"
	"strconv"
)


type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type PostgresConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

func GetEnvString(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func GetEnvInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

func LoadRedisConfig() RedisConfig {
	return RedisConfig{
		Host:     	GetEnvString("REDIS_HOST", "localhost"),
		Port:     	GetEnvInt("REDIS_PORT", 6379),
		Password: 	GetEnvString("REDIS_PASSWORD", ""),
		DB:			GetEnvInt("REDIS_DB", 0),
	}
}

func LoadPostgresConfig() PostgresConfig {
	return PostgresConfig{
		Host:     GetEnvString("POSTGRES_HOST", "localhost"),
		Port:     GetEnvInt("POSTGRES_PORT", 5432),
		User:     GetEnvString("POSTGRES_USER", "postgres"),
		Password: GetEnvString("POSTGRES_PASSWORD", ""),
		Database: GetEnvString("POSTGRES_DATABASE", "postgres"),
	}
}