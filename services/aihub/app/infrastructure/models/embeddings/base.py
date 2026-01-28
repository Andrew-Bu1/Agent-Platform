from abc import abstractmethod
from app.infrastructure.models.base import BaseModel

class BaseEmbeddingModel(BaseModel):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        pass

    @property
    @abstractmethod
    def embedding_dimension(self) -> int:
        """Return the dimension of the embeddings produced by the model."""
        pass

    @property
    @abstractmethod
    def max_sequence_length(self) -> int:
        """Return the maximum sequence length supported by the model."""
        pass