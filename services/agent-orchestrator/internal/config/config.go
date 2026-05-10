package config

import "libs/go/common/config"

type Config struct {
	Postgres    *config.PostgresConfig
	Redis       *config.RedisConfig
	NodeQueue   string
	EventQueue  string
	DLQKey      string
	Port        int
	WorkerCount int
}

func Load() *Config {
	return &Config{
		Postgres:    config.LoadPostgresConfig(),
		Redis:       config.LoadRedisConfig(),
		NodeQueue:   config.GetEnvString("REDIS_NODE_QUEUE", "agent:queue:node"),
		EventQueue:  config.GetEnvString("REDIS_EVENT_QUEUE", "agent:queue:events"),
		DLQKey:      config.GetEnvString("REDIS_DLQ_KEY", "agent:queue:dlq"),
		Port:        config.GetEnvInt("PORT", 8081),
		WorkerCount: config.GetEnvInt("EVENT_WORKER_COUNT", 4),
	}
}
