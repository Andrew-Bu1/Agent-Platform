package config

import (
	"libs/go/common/config"
)

type Config struct {
	postgresConfig 		*config.PostgresConfig
	minioConfig 		*config.MinioConfig
	Port			int
}

func Load() *Config {
	postgresCfg := config.LoadPostgresConfig()
	minioCfg := config.LoadMinioConfig()

	Port := config.GetEnvInt("PORT", 8080)
	return &Config {
		postgresConfig: &postgresCfg,
		minioConfig: 	&minioCfg,
		Port: Port,
	}
}