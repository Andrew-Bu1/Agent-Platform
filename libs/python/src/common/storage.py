import io

from minio import Minio
from minio.error import S3Error

from common.config import MinioConfig


class MinioStorage:
    def __init__(self, cfg: MinioConfig) -> None:
        self._client = Minio(
            cfg.endpoint,
            access_key=cfg.access_key,
            secret_key=cfg.secret_key,
            secure=cfg.secure,
        )
        self._bucket = cfg.bucket
        self._public_url = cfg.public_url.rstrip("/")

    def ensure_bucket(self) -> None:
        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def upload(self, object_name: str, data: bytes, content_type: str) -> str:
        self._client.put_object(
            self._bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return f"{self._public_url}/{self._bucket}/{object_name}"

    def delete(self, object_name: str) -> None:
        try:
            self._client.remove_object(self._bucket, object_name)
        except S3Error:
            pass
