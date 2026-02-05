package database

import (
	"context"
	"fmt"
	"libs/go/common/config"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedisClient() *RedisClient {
	return &RedisClient{}
}

func (c *RedisClient) Connect(ctx context.Context, cfg config.RedisConfig) error {
	c.client = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	if err := c.client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return nil
}

func (c *RedisClient) Disconnect() error {
	if c.client != nil {
		return c.client.Close()
	}
	return nil
}

func (c *RedisClient) Get(ctx context.Context, key string) (string, error) {
	if c.client == nil {
		return "", fmt.Errorf("Redis connection is not established")
	}

	val, err := c.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil // Key does not exist
	}
	if err != nil {
		return "", fmt.Errorf("failed to get key %s: %w", key, err)
	}

	return val, nil
}

func (c *RedisClient) Set(ctx context.Context, key string, value string, expiration time.Duration) error {
	if c.client == nil {
		return fmt.Errorf("Redis connection is not established")
	}

	err := c.client.Set(ctx, key, value, expiration).Err()
	if err != nil {
		return fmt.Errorf("failed to set key %s: %w", key, err)
	}

	return nil
}
