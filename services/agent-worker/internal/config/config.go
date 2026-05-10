package config

import (
	libconfig "libs/go/common/config"
)

type Config struct {
	Postgres    *libconfig.PostgresConfig
	Redis       *libconfig.RedisConfig
	NodeQueue   string
	EventQueue  string
	DLQKey      string
	AihubURL    string
	WorkerCount int
	Port        int
}

func Load() *Config {
	return &Config{
		Postgres:    libconfig.LoadPostgresConfig(),
		Redis:       libconfig.LoadRedisConfig(),
		NodeQueue:   libconfig.GetEnvString("NODE_QUEUE_KEY", "agent:queue:node"),
		EventQueue:  libconfig.GetEnvString("EVENT_QUEUE_KEY", "agent:queue:events"),
		DLQKey:      libconfig.GetEnvString("DLQ_KEY", "agent:queue:dlq"),
		AihubURL:    libconfig.GetEnvString("AIHUB_URL", "http://localhost:8000"),
		WorkerCount: libconfig.GetEnvInt("WORKER_COUNT", 4),
		Port:        libconfig.GetEnvInt("PORT", 8082),
	}
}
