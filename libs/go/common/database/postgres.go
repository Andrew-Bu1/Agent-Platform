package database

import (
	"context"
	"database/sql"
	"fmt"
	"libs/go/common/config"

	_ "github.com/lib/pq"
)

type PostgresClient struct {
	db *sql.DB
}

func NewPostgresClient() *PostgresClient {
	return &PostgresClient{}
}

func (c *PostgresClient) Connect(ctx context.Context, cfg config.PostgresConfig) error {
	connStr := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Database,
	)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}

	c.db = db
	return nil
}

func (c *PostgresClient) Disconnect() error {
	if c.db != nil {
		return c.db.Close()
	}
	return nil
}

func (c *PostgresClient) ExecuteQuery(ctx context.Context, sql string, params ...interface{}) (*sql.Rows, error) {
	if c.db == nil {
		return nil, fmt.Errorf("database connection is not established")
	}

	rows, err := c.db.QueryContext(ctx, sql, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}

	return rows, nil
}