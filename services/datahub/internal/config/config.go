package config

import (
	"libs/go/common/config"
)

type Config struct {
	Postgres       *config.PostgresConfig
	Minio          *config.MinioConfig
	Redis          *config.RedisConfig
	IngestionQueue string
	DLQKey         string
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
		DLQKey:         config.GetEnvString("REDIS_DLQ_KEY", "datahub:queue:dlq"),
		Port:           config.GetEnvInt("PORT", 8080),
	}
}