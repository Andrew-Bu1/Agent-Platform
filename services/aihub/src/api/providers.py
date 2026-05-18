from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel

from common.logger import get_logger

from src.api.dependencies import get_caller_context, get_providers_repo
from src.models.auth import CallerContext
from src.repositories.providers import ProvidersRepository
from common.storage import MinioStorage
from src.utils.crypto import encrypt

# SVG is intentionally excluded: if served with the wrong Content-Type it can
# carry embedded scripts (stored-XSS).  Add it back only if the storage layer
# serves all uploads with Content-Disposition: attachment or a sandboxed origin.
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Maximum upload size for provider logos (5 MiB).
_MAX_LOGO_BYTES = 5 * 1024 * 1024

# Magic-byte signatures for the image formats we accept.
_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),  # confirmed below by checking bytes[8:12] == b"WEBP"
]


def _sniff_content_type(data: bytes) -> str | None:
    for magic, mime in _MAGIC:
        if data[:len(magic)] == magic:
            if mime == "image/webp" and data[8:12] != b"WEBP":
                continue
            return mime
    return None


def _require_provider_manage(ctx: CallerContext) -> None:
    """Raise 403 unless the caller holds the provider:manage permission."""
    if "provider:manage" not in ctx.permissions:
        raise HTTPException(status_code=403, detail="provider:manage permission required")


def _get_minio(request: Request) -> MinioStorage:
    storage = getattr(request.app.state, "minio", None)
    if storage is None:
        raise HTTPException(status_code=503, detail="File storage is not configured")
    return storage


class ProviderCreate(BaseModel):
    provider_key: str
    display_name: str
    description: str | None = None
    logo_url: str | None = None
    base_url: str | None = None
    adapter_type: str = "openai_compatible"
    sort_order: int = 0
    api_key: str | None = None  # plaintext — stored encrypted in config_json


class ProviderUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    logo_url: str | None = None
    base_url: str | None = None
    adapter_type: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    api_key: str | None = None  # provide to rotate the key; omit to leave unchanged


def _encryption_key(request: Request) -> str | None:
    return getattr(request.app.state, "provider_encryption_key", None)


def _build_config_json(api_key: str | None, enc_key: str | None) -> dict:
    if not api_key:
        return {}
    if not enc_key:
        raise HTTPException(
            status_code=500,
            detail="PROVIDER_ENCRYPTION_KEY is not configured — cannot store API key",
        )
    return {"api_key": encrypt(enc_key, api_key)}


def router() -> APIRouter:
    r = APIRouter(prefix="/providers", tags=["providers"])
    logger = get_logger(__name__)

    @r.get("")
    async def list_providers(
        _ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        return await repo.list()

    @r.get("/{id}")
    async def get_provider(
        id: UUID,
        _ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        provider = await repo.get_by_id(id)
        if provider is None:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider

    @r.post("", status_code=201)
    async def create_provider(
        request: Request,
        body: ProviderCreate,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        _require_provider_manage(ctx)
        logger.info(f"Creating provider: key={body.provider_key!r} adapter={body.adapter_type!r}")
        config_json = _build_config_json(body.api_key, _encryption_key(request))
        try:
            return await repo.create(
                id=uuid4(),
                provider_key=body.provider_key,
                display_name=body.display_name,
                description=body.description,
                logo_url=body.logo_url,
                base_url=body.base_url,
                adapter_type=body.adapter_type,
                sort_order=body.sort_order,
                config_json=config_json,
            )
        except Exception as e:
            if "unique" in str(e).lower():
                raise HTTPException(status_code=409, detail=f"Provider key '{body.provider_key}' already exists")
            logger.exception(f"Unexpected error creating provider: {e}")
            raise

    @r.patch("/{id}")
    async def update_provider(
        id: UUID,
        request: Request,
        body: ProviderUpdate,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        _require_provider_manage(ctx)
        config_json = _build_config_json(body.api_key, _encryption_key(request)) if body.api_key else None
        provider = await repo.update(
            id,
            display_name=body.display_name,
            description=body.description,
            logo_url=body.logo_url,
            base_url=body.base_url,
            adapter_type=body.adapter_type,
            is_active=body.is_active,
            sort_order=body.sort_order,
            config_json=config_json,
        )
        if provider is None:
            raise HTTPException(status_code=404, detail="Provider not found")
        return provider

    @r.delete("/{id}", status_code=204)
    async def delete_provider(
        id: UUID,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        _require_provider_manage(ctx)
        try:
            deleted = await repo.delete(id)
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=409, detail="Provider is referenced by one or more model configs")
        if not deleted:
            raise HTTPException(status_code=404, detail="Provider not found")

    @r.post("/{id}/logo")
    async def upload_provider_logo(
        id: UUID,
        request: Request,
        file: UploadFile,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        _require_provider_manage(ctx)

        provider = await repo.get_by_id(id)
        if provider is None:
            raise HTTPException(status_code=404, detail="Provider not found")

        # Read up to the size limit + 1 byte so we can detect oversized uploads
        # without loading the entire file into memory first.
        data = await file.read(_MAX_LOGO_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if len(data) > _MAX_LOGO_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum allowed size of {_MAX_LOGO_BYTES // (1024 * 1024)} MiB",
            )

        # Sniff the actual content type from magic bytes — never trust the
        # client-supplied Content-Type header.
        detected_type = _sniff_content_type(data)
        if detected_type is None or detected_type not in _ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"File content is not a supported image type. Allowed: jpeg, png, webp, gif",
            )

        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }.get(detected_type, "")
        object_name = f"logos/{id}/logo{ext}"

        minio = _get_minio(request)
        logo_url = minio.upload(object_name, data, detected_type)
        logger.info(f"Uploaded logo for provider {id}: {logo_url}")

        updated = await repo.update(
            id,
            display_name=None,
            description=None,
            logo_url=logo_url,
            base_url=None,
            adapter_type=None,
            is_active=None,
            sort_order=None,
            config_json=None,
        )
        return updated

    return r
