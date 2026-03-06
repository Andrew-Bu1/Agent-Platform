package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"libs/go/common/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioStorage struct {
	client *minio.Client
	bucket string
}

func NewMinioStorage(cfg *config.MinioConfig) (*MinioStorage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: false,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("minio.New: %w", err)
	}
	return &MinioStorage{client: client, bucket: cfg.Bucket}, nil
}

// EnsureBucket creates the bucket if it does not already exist.
func (s *MinioStorage) EnsureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("BucketExists: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("MakeBucket: %w", err)
		}
	}
	return nil
}

// UploadFile stores data under objectName and returns the storage path.
func (s *MinioStorage) UploadFile(ctx context.Context, objectName string, data []byte) (string, error) {
	contentType := http.DetectContentType(data)
	_, err := s.client.PutObject(ctx, s.bucket, objectName, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		return "", fmt.Errorf("PutObject %s: %w", objectName, err)
	}
	return fmt.Sprintf("%s/%s", s.bucket, objectName), nil
}

// DeleteFile removes an object from the bucket.
func (s *MinioStorage) DeleteFile(ctx context.Context, objectName string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, objectName, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("RemoveObject %s: %w", objectName, err)
	}
	return nil
}
