from fastapi import APIRouter, FastAPI, Depends
from src.presentation.dtos.embedding import EmbeddingRequest
from src.dependencies import get_embedding_service
from src.application.services.embedding import EmbeddingService

def include_router(app: FastAPI) -> None:
    router = APIRouter(prefix="/embedding", tags=["Embedding Model"])

    @router.post("")
    async def embed(
        request: EmbeddingRequest,
        service: "EmbeddingService" = Depends(get_embedding_service)
    ):
        return await service.embed(model_id=request.model, input=request.input)


    app.include_router(router)