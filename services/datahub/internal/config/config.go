package config

import (
	"libs/go/common/config"
)

type Config struct {
	Postgres 		*config.PostgresConfig
	Minio    		*config.MinioConfig
	Redis   		*config.RedisConfig
	IngestionQueue 	string
	Port           	int
}


func Load() *Config {
	postgresCfg := config.LoadPostgresConfig()
	minioCfg := config.LoadMinioConfig()
	redisCfg := config.LoadRedisConfig()

	Port := config.GetEnvInt("PORT", 8080)
	IngestionQueue := config.GetEnvString("REDIS_INGESTION_QUEUE", "")

	return &Config {
		Postgres: 		postgresCfg,
		Minio: 			minioCfg,
		Redis: 			redisCfg,
		IngestionQueue: IngestionQueue,
		Port: 			Port,
	}
}