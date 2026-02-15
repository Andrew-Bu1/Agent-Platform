from .embedding import include_router as set_embedding_router
from .rerank import include_router as set_rerank_router

__all__ = [
    "set_embedding_router",
    "set_rerank_router",
]