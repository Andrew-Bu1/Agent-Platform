from sentence_transformers import SentenceTransformer
from app.infrastructure.models.embeddings.base import BaseEmbeddingModel

class MiniLMEmbeddingModel(BaseEmbeddingModel):

    MODEL_VARIANTS = {
        "all-MiniLM-L6-v2": {"embedding_dimension": 384, "max_sequence_length": 256},
        "all-MiniLM-L12-v2": {"embedding_dimension": 384, "max_sequence_length": 256},
    }

    def __init__(self, model_name: str, device = "cpu"):
        super().__init__(model_name, device)
        self._config = self.MODEL_VARIANTS.get(model_name)

    @property
    def model_id(self) -> str:
        return self.model_name
    
    @property
    def embedding_dimension(self) -> int:
        return self._config["embedding_dimension"]
    
    @property
    def max_sequence_length(self) -> int:
        return self._config["max_sequence_length"]
    
    def load(self) -> None:
        self._logger.info(f"Loading MiniLM model: {self.model_name} on device: {self.device}")
        self._model = SentenceTransformer(
            self.model_name, 
            cache_folder="models/embeddings/" + self.model_name,
            device=self.device
        )

    def unload(self) -> None:
        self._logger.info(f"Unloading MiniLM model: {self.model_name}")
        self._model = None

    def embed(self, inputs: list[str] | str) -> list[list[float]]:
        return [[]]