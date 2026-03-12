from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.dependencies import get_service_router
from src.models.embedding import EmbedResponse
from src.services.router import ServiceRouter

from common.logger import get_logger

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
    ) -> EmbedResponse:
        logger.info(f"Received embedding request for model {request.model} with input of type {type(request.input)}")
        inputs = request.input if isinstance(request.input, list) else [request.input]
        return await service_router.embed(request.model, inputs)

    return r