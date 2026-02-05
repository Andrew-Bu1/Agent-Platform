package config

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

type MinioConfig struct {
	Endpoint 	  	string
	AccessKeyID     string
	SecretAccessKey string
	Bucket			string
	Region			string
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

func LoadMinioConfig() MinioConfig {
	return MinioConfig{
		Endpoint:       	GetEnvString("MINIO_ENDPOINT", "localhost:9000"),
		AccessKeyID:    	GetEnvString("MINIO_ACCESS_KEY_ID", "minioadmin"),
		SecretAccessKey: 	GetEnvString("MINIO_SECRET_ACCESS_KEY", "minioadmin"),
		Bucket:			GetEnvString("MINIO_BUCKET", "datahub"),
		Region:			GetEnvString("MINIO_REGION", "us-east-1"),
	}
}