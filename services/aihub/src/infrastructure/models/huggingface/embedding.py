from sentence_transformers import SentenceTransformer
from src.domain.models.embedding import EmbeddingModel

class HuggingFaceEmbeddingModel(EmbeddingModel):
    def __init__(self, model_id: str, device: str = "cpu"):
        super().__init__(model_id, device)
        self._model: SentenceTransformer | None = None

    def load(self) -> None:
        from pathlib import Path
        
        cache_dir = Path(".models")
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        safe_model_name = self.model_id.replace("/", "--")
        model_path = cache_dir / safe_model_name
        
        if model_path.exists():
            self._model = SentenceTransformer(str(model_path), device=self.device)
        else:
            temp_model = SentenceTransformer(self.model_id, device=self.device)
            temp_model.save(str(model_path))
            self._model = temp_model
            
        self._is_loaded = True

    def unload(self) -> None:
        self._model = None
        self._is_loaded = False

    def predict(self, input: str | list[str]) -> list[list[float]]:
        if not self._is_loaded:
            raise RuntimeError("Model not loaded")

        embeddings = self._model.encode(
            input,
            convert_to_numpy=True,
        )
        return embeddings.tolist()