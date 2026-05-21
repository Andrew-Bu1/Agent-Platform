package config

import (
	"libs/go/common/config"
)

type Config struct {
	Postgres       *config.PostgresConfig
	Minio          *config.MinioConfig
	Redis          *config.RedisConfig
	IngestionQueue string
	EmbedQueue     string
	DLQKey         string
	IamURL         string
	Port           int
}

func Load() *Config {
	postgresCfg := config.LoadPostgresConfig()
	minioCfg := config.LoadMinioConfig()
	redisCfg := config.LoadRedisConfig()

	return &Config{
		Postgres:       postgresCfg,
		Minio:          minioCfg,
		Redis:          redisCfg,
		IngestionQueue: config.GetEnvString("REDIS_INGESTION_QUEUE", "datahub:queue:ingestion"),
		EmbedQueue:     config.GetEnvString("REDIS_EMBEDDING_QUEUE", "datahub:queue:embedding"),
		DLQKey:         config.GetEnvString("REDIS_DLQ_KEY", "datahub:queue:dlq"),
		IamURL:         config.GetEnvString("IAM_URL", "http://iam-service:8080"),
		Port:           config.GetEnvInt("PORT", 8080),
	}
}