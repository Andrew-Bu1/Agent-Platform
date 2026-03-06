package config

import (
	"libs/go/common/config"
)

type Config struct {
	postgresConfig 	*config.PostgresConfig
	minioConfig    	*config.MinioConfig
	redisConfig   	*config.RedisConfig
	Port           	int
}

func (c *Config) PostgresConfig() *config.PostgresConfig {
	return c.postgresConfig
}

func (c *Config) MinioConfig() *config.MinioConfig {
	return c.minioConfig
}

func (c *Config) RedisConfig() *config.RedisConfig {
	return c.redisConfig
}

func Load() *Config {
	postgresCfg := config.LoadPostgresConfig()
	minioCfg := config.LoadMinioConfig()
	redisCfg := config.LoadRedisConfig()

	Port := config.GetEnvInt("PORT", 8080)
	return &Config {
		postgresConfig: &postgresCfg,
		minioConfig: 	&minioCfg,
		redisConfig: 	&redisCfg,
		Port: Port,
	}
}