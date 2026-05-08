from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from common.logger import get_logger

from src.api.dependencies import get_providers_repo
from src.repositories.providers import ProvidersRepository
from src.utils.crypto import encrypt


class ProviderCreate(BaseModel):
    provider_key: str
    display_name: str
    description: str | None = None
    base_url: str | None = None
    adapter_type: str = "openai_compatible"
    sort_order: int = 0
    api_key: str | None = None  # plaintext — stored encrypted in config_json


class ProviderUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
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
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        return await repo.list()

    @r.get("/{id}")
    async def get_provider(
        id: UUID,
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
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        logger.info(f"Creating provider: key={body.provider_key!r} adapter={body.adapter_type!r}")
        config_json = _build_config_json(body.api_key, _encryption_key(request))
        try:
            return await repo.create(
                id=uuid4(),
                provider_key=body.provider_key,
                display_name=body.display_name,
                description=body.description,
                base_url=body.base_url,
                adapter_type=body.adapter_type,
                sort_order=body.sort_order,
                config_json=config_json,
            )
        except Exception as e:
            if "unique" in str(e).lower():
                raise HTTPException(status_code=409, detail=f"Provider key '{body.provider_key}' already exists")
            raise

    @r.patch("/{id}")
    async def update_provider(
        id: UUID,
        request: Request,
        body: ProviderUpdate,
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        config_json = _build_config_json(body.api_key, _encryption_key(request)) if body.api_key else None
        provider = await repo.update(
            id,
            display_name=body.display_name,
            description=body.description,
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
        repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        deleted = await repo.delete(id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Provider not found")

    return r
