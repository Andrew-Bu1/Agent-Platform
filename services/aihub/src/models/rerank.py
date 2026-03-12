from pydantic import BaseModel


class RerankResult(BaseModel):
    index: int
    document: str
    relevance_score: float


class RerankResponse(BaseModel):
    model: str
    results: list[RerankResult]
