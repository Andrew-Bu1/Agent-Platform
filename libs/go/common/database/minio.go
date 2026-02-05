package database

import (
	"context"
	"fmt"
	"io"
	"libs/go/common/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinioClient struct {
	client *minio.Client
	bucket string
}

func NewMinioClient(bucket string) *MinioClient {
	return &MinioClient{
		bucket: bucket,
	}
}

func (c *MinioClient) Connect(ctx context.Context, cfg config.MinioConfig) error {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(
			cfg.AccessKeyID, 
			cfg.SecretAccessKey, 
			"",
		),
		Region: cfg.Region,
	})
	if err != nil {
		return fmt.Errorf("failed to create MinIO client: %w", err)
	}

	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return fmt.Errorf("failed to check if bucket exists: %w", err)
	}

	if !exists {
		err = client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{Region: cfg.Region})
		if err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	c.client = client
	c.bucket = cfg.Bucket
	return nil
}

func (c *MinioClient) Disconnect() error {
	c.client = nil
	return nil
}

func (c *MinioClient) UploadFile(
	ctx context.Context,
	objectName string,
	reader io.Reader,
	size int64,
	contentType string,
) error {

	_, err := c.client.PutObject(
		ctx,
		c.bucket,
		objectName,
		reader,
		size,
		minio.PutObjectOptions{
			ContentType: contentType,
		},
	)

	return err
}

func (c *MinioClient) GetObject(
	ctx context.Context,
	objectName string,
) (*minio.Object, error) {
	return c.client.GetObject(ctx, c.bucket, objectName, minio.GetObjectOptions{})
}