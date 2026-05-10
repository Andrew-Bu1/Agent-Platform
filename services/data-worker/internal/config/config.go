package config

import (
	"libs/go/common/config"
)

type Config struct {
	Postgres          *config.PostgresConfig
	Minio             *config.MinioConfig
	Redis             *config.RedisConfig
	IngestionQueue    string
	ChunkingQueue     string
	EmbeddingQueue    string
	DLQKey            string
	AihubURL          string
	IamURL            string
	IamOAuthClientID  string
	IamOAuthSecret    string
	WorkerConcurrency int
}

func Load() *Config {
	postgresCfg := config.LoadPostgresConfig()
	minioCfg := config.LoadMinioConfig()
	redisCfg := config.LoadRedisConfig()

	return &Config{
		Postgres:          postgresCfg,
		Minio:             minioCfg,
		Redis:             redisCfg,
		IngestionQueue:    config.GetEnvString("REDIS_INGESTION_QUEUE", "datahub:queue:ingestion"),
		ChunkingQueue:     config.GetEnvString("REDIS_CHUNKING_QUEUE", "datahub:queue:chunking"),
			EmbeddingQueue:    config.GetEnvString("REDIS_EMBEDDING_QUEUE", "datahub:queue:embedding"),
			DLQKey:            config.GetEnvString("REDIS_DLQ_KEY", "datahub:queue:dlq"),
			AihubURL:          config.GetEnvString("AIHUB_URL", "http://localhost:8000"),
			IamURL:            config.GetEnvString("IAM_URL", "http://iam-service:8080"),
			IamOAuthClientID:  config.GetEnvString("IAM_OAUTH_CLIENT_ID", ""),
			IamOAuthSecret:    config.GetEnvString("IAM_OAUTH_CLIENT_SECRET", ""),
			WorkerConcurrency: config.GetEnvInt("WORKER_CONCURRENCY", 4),
		}
}
