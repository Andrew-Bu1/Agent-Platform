from decimal import Decimal
from uuid import UUID, uuid4

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from common.logger import get_logger

from src.api.dependencies import get_caller_context, get_entitlement_guard, get_model_config_repo, get_providers_repo
from src.models.auth import CallerContext
from src.repositories.model_config import ModelConfigRepository
from src.repositories.providers import ProvidersRepository
from src.services.entitlement import EntitlementGuard


def _require_model_manage(ctx: CallerContext) -> None:
    """Raise 403 unless the caller holds the model:manage permission."""
    if "model:manage" not in ctx.permissions:
        raise HTTPException(status_code=403, detail="model:manage permission required")


class ModelConfigCreate(BaseModel):
    provider_key: str       # e.g. "openrouter", "self-host"
    model_key: str          # our internal key, e.g. "claude-3-5-sonnet"
    display_name: str
    description: str | None = None
    provider_model_id: str  # actual model ID at provider, e.g. "anthropic/claude-3-5-sonnet"
    operation_type: str     # chat | embed | rerank
    task_type: str | None = None
    endpoint_url: str | None = None
    input_cost: Decimal | None = None
    output_cost: Decimal | None = None
    context_window_tokens: int | None = None
    max_output_tokens: int | None = None
    embedding_dimensions: int | None = None
    supports_streaming: bool = False
    supports_tools: bool = False
    supports_json_mode: bool = False
    supports_vision: bool = False


class ModelConfigUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    endpoint_url: str | None = None
    input_cost: Decimal | None = None
    output_cost: Decimal | None = None
    context_window_tokens: int | None = None
    max_output_tokens: int | None = None
    supports_streaming: bool | None = None
    supports_tools: bool | None = None
    supports_json_mode: bool | None = None
    supports_vision: bool | None = None
    is_active: bool | None = None


def router() -> APIRouter:
    r = APIRouter(prefix="/models", tags=["model-configs"])
    logger = get_logger(__name__)

    @r.get("")
    async def list_model_configs(
        operation_type: str | None = Query(default=None),
        provider_key: str | None = Query(default=None),
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
        guard: EntitlementGuard = Depends(get_entitlement_guard),
    ):
        models = await repo.list(operation_type=operation_type, provider_key=provider_key)
        # Platform admins (model:manage) can see all model configs regardless of
        # tenant entitlements; regular callers only see their entitled models.
        if "model:manage" in ctx.permissions:
            return models
        allowed = await guard.get_allowed_keys(ctx.tenant_id, ctx.bearer_token)
        return [m for m in models if (m.model_key, m.operation_type) in allowed]

    @r.get("/{id}")
    async def get_model_config(
        id: UUID,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
        guard: EntitlementGuard = Depends(get_entitlement_guard),
    ):
        config = await repo.get_by_id(id)
        if config is None:
            raise HTTPException(status_code=404, detail="Model config not found")
        if "model:manage" not in ctx.permissions:
            allowed = await guard.get_allowed_keys(ctx.tenant_id, ctx.bearer_token)
            if (config.model_key, config.operation_type) not in allowed:
                raise HTTPException(status_code=404, detail="Model config not found")
        return config

    @r.post("", status_code=201)
    async def create_model_config(
        body: ModelConfigCreate,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
        providers_repo: ProvidersRepository = Depends(get_providers_repo),
    ):
        _require_model_manage(ctx)
        provider_id = await providers_repo.get_id_by_key(body.provider_key)
        if provider_id is None:
            raise HTTPException(status_code=404, detail=f"Provider '{body.provider_key}' not found")

        logger.info(f"Creating model config: model_key={body.model_key!r} provider={body.provider_key!r}")
        return await repo.create(
            id=uuid4(),
            provider_id=provider_id,
            model_key=body.model_key,
            display_name=body.display_name,
            description=body.description,
            provider_model_id=body.provider_model_id,
            operation_type=body.operation_type,
            task_type=body.task_type,
            endpoint_url=body.endpoint_url,
            input_cost=body.input_cost,
            output_cost=body.output_cost,
            context_window_tokens=body.context_window_tokens,
            max_output_tokens=body.max_output_tokens,
            embedding_dimensions=body.embedding_dimensions,
            supports_streaming=body.supports_streaming,
            supports_tools=body.supports_tools,
            supports_json_mode=body.supports_json_mode,
            supports_vision=body.supports_vision,
        )

    @r.patch("/{id}")
    async def update_model_config(
        id: UUID,
        body: ModelConfigUpdate,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        _require_model_manage(ctx)
        config = await repo.update(
            id=id,
            display_name=body.display_name,
            description=body.description,
            endpoint_url=body.endpoint_url,
            input_cost=body.input_cost,
            output_cost=body.output_cost,
            context_window_tokens=body.context_window_tokens,
            max_output_tokens=body.max_output_tokens,
            supports_streaming=body.supports_streaming,
            supports_tools=body.supports_tools,
            supports_json_mode=body.supports_json_mode,
            supports_vision=body.supports_vision,
            is_active=body.is_active,
        )
        if config is None:
            raise HTTPException(status_code=404, detail="Model config not found")
        return config

    @r.delete("/{id}", status_code=204)
    async def delete_model_config(
        id: UUID,
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        _require_model_manage(ctx)
        try:
            deleted = await repo.delete(id)
        except asyncpg.ForeignKeyViolationError:
            raise HTTPException(status_code=409, detail="Model config is referenced by one or more usage logs")
        if not deleted:
            raise HTTPException(status_code=404, detail="Model config not found")

    return r
