import asyncio
import os

from sentence_transformers import SentenceTransformer

from src.models.embedding import EmbedData, EmbedResponse, EmbedUsage
from src.models.model_config import ModelConfig


class LocalEmbeddingService:
    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._models: dict[str, SentenceTransformer] = {}

    def _resolve(self, config: ModelConfig) -> str:
        """Use local directory if it exists, fall back to provider_model_id (HF Hub ID)."""
        local_path = os.path.join(self._model_dir, config.model_key)
        return local_path if os.path.isdir(local_path) else config.provider_model_id

    def _get_model(self, config: ModelConfig) -> SentenceTransformer:
        if config.model_key not in self._models:
            self._models[config.model_key] = SentenceTransformer(
                self._resolve(config), cache_folder=self._model_dir
            )
        return self._models[config.model_key]

    async def embed(self, model_config: ModelConfig, inputs: list[str]) -> EmbedResponse:
        loop = asyncio.get_event_loop()
        model = self._get_model(model_config)
        embeddings = await loop.run_in_executor(
            None, lambda: model.encode(inputs, convert_to_numpy=True).tolist()
        )
        return EmbedResponse(
            model=model_config.model_key,
            data=[EmbedData(index=i, embedding=emb) for i, emb in enumerate(embeddings)],
            usage=EmbedUsage(total_tokens=sum(len(t.split()) for t in inputs)),
        )
