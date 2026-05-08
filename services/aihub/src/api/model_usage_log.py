from uuid import UUID

from fastapi import APIRouter, Depends, Query

from src.api.dependencies import get_caller_context, get_model_usage_log_repo
from src.middleware.auth import CallerContext
from src.repositories.model_usage_log import ModelUsageLogRepository


def router() -> APIRouter:
    r = APIRouter(prefix="/model-usage-logs", tags=["model-usage-logs"])

    @r.get("")
    async def list_usage_logs(
        model_id: UUID | None = Query(default=None),
        status: str | None = Query(default=None),
        limit: int = Query(default=50, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
        repo: ModelUsageLogRepository = Depends(get_model_usage_log_repo),
        ctx: CallerContext = Depends(get_caller_context),
    ):
        # Scoped to the caller's tenant automatically.
        return await repo.list(
            tenant_id=ctx.tenant_id,
            model_id=model_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    return r
