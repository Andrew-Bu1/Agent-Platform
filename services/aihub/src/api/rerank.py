from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.dependencies import get_caller_context, get_feature_guard, get_service_router
from src.middleware.auth import CallerContext
from src.models.rerank import RerankResponse
from src.services.entitlement import FeatureGuard
from src.services.router import ServiceRouter


class RerankRequest(BaseModel):
    model: str
    query: str
    documents: list[str]
    top_n: int | None = None


def router() -> APIRouter:
    r = APIRouter(tags=["rerank"])

    @r.post("/rerank", response_model=RerankResponse)
    async def rerank(
        request: RerankRequest,
        service_router: ServiceRouter = Depends(get_service_router),
        ctx: CallerContext = Depends(get_caller_context),
        feature_guard: FeatureGuard = Depends(get_feature_guard),
    ) -> RerankResponse:
        if "model:invoke" not in ctx.permissions:
            raise HTTPException(status_code=403, detail="permission denied: model:invoke")
        await feature_guard.require(ctx.tenant_id, ctx.bearer_token, "aihub.rerank")
        return await service_router.rerank(
            request.model, request.query, request.documents, request.top_n, ctx
        )

    return r
