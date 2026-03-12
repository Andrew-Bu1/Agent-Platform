from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.dependencies import get_model_config_repo
from src.repositories.model_config import ModelConfigRepository

from common.logger import get_logger

class ModelConfigCreate(BaseModel):
    name: str
    task_type: str
    provider: str
    endpoint_url: str | None = None
    input_cost: Decimal | None = None
    output_cost: Decimal | None = None


class ModelConfigUpdate(BaseModel):
    name: str | None = None
    task_type: str | None = None
    provider: str | None = None
    endpoint_url: str | None = None
    input_cost: Decimal | None = None
    output_cost: Decimal | None = None
    is_active: bool | None = None


def router() -> APIRouter:
    r = APIRouter(prefix="/models", tags=["model-configs"])
    logger = get_logger(__name__)

    @r.get("")
    async def list_model_configs(
        task_type: str | None = Query(default=None),
        provider: str | None = Query(default=None),
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        return await repo.list(task_type=task_type, provider=provider)

    @r.get("/{id}")
    async def get_model_config(
        id: UUID,
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        config = await repo.get_by_id(id)
        if config is None:
            raise HTTPException(status_code=404, detail="Model config not found")
        return config

    @r.post("", status_code=201)
    async def create_model_config(
        body: ModelConfigCreate,
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        logger.info(f"Creating model config with name={body.name}, task_type={body.task_type}, provider={body.provider}")
        return await repo.create(
            id=uuid4(),
            name=body.name,
            task_type=body.task_type,
            provider=body.provider,
            endpoint_url=body.endpoint_url,
            input_cost=body.input_cost,
            output_cost=body.output_cost,
        )

    @r.patch("/{id}")
    async def update_model_config(
        id: UUID,
        body: ModelConfigUpdate,
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        config = await repo.update(
            id=id,
            name=body.name,
            task_type=body.task_type,
            provider=body.provider,
            endpoint_url=body.endpoint_url,
            input_cost=body.input_cost,
            output_cost=body.output_cost,
            is_active=body.is_active,
        )
        if config is None:
            raise HTTPException(status_code=404, detail="Model config not found")
        return config

    @r.delete("/{id}", status_code=204)
    async def delete_model_config(
        id: UUID,
        repo: ModelConfigRepository = Depends(get_model_config_repo),
    ):
        deleted = await repo.delete(id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Model config not found")

    return r
