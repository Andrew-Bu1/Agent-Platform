from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.dependencies import get_caller_context, get_service_router
from src.middleware.auth import CallerContext
from src.models.rerank import RerankResponse
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
    ) -> RerankResponse:
        return await service_router.rerank(
            request.model, request.query, request.documents, request.top_n, ctx
        )

    return r
