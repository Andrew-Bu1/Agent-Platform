from pydantic import BaseModel

class EmbeddingRequest(BaseModel):
    input: str | list[str]
    model: str

# class EmbeddingResponse(BasdeModel):
