from pydantic import BaseModel


class EmbedData(BaseModel):
    index: int
    embedding: list[float]


class EmbedUsage(BaseModel):
    prompt_tokens: int | None = None
    total_tokens: int | None = None


class EmbedResponse(BaseModel):
    model: str
    data: list[EmbedData]
    usage: EmbedUsage | None = None
