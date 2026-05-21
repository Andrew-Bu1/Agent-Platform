from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from common.logger import get_logger

from src.api.dependencies import get_caller_context, get_feature_guard, get_service_router
from src.middleware.auth import CallerContext
from src.models.embedding import EmbedResponse
from src.services.entitlement import FeatureGuard
from src.services.router import ServiceRouter


class EmbedRequest(BaseModel):
    model: str
    input: list[str] | str


def router() -> APIRouter:
    r = APIRouter(tags=["embedding"])
    logger = get_logger(__name__)

    @r.post("/embed", response_model=EmbedResponse)
    async def embed(
        request: EmbedRequest,
        service_router: ServiceRouter = Depends(get_service_router),
        ctx: CallerContext = Depends(get_caller_context),
        feature_guard: FeatureGuard = Depends(get_feature_guard),
    ) -> EmbedResponse:
        if "model:invoke" not in ctx.permissions:
            raise HTTPException(status_code=403, detail="permission denied: model:invoke")
        await feature_guard.require(ctx.tenant_id, ctx.bearer_token, "aihub.embedding")
        inputs = request.input if isinstance(request.input, list) else [request.input]
        logger.info(f"Embed request: model={request.model!r} inputs={len(inputs)} tenant={ctx.tenant_id}")
        return await service_router.embed(request.model, inputs, ctx)

    return r
