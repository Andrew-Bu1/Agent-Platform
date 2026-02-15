from src.domain.models.embedding import EmbeddingModel
from src.infrastructure.models.huggingface.embedding import HuggingFaceEmbeddingModel
from .base import BaseModelFactory

class EmbedingFactory(BaseModelFactory):

    def create(self, model_config: dict) -> EmbeddingModel:
        provider = model_config.get("provider")
        model_id = model_config.get("model_id")
        device = model_config.get("device")
        
        if provider == "huggingface":
            return HuggingFaceEmbeddingModel(model_id, device)
        raise ValueError(f"Unknown provider: {provider}")

