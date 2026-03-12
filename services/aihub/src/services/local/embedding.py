import asyncio
import os

from sentence_transformers import SentenceTransformer

from src.models.embedding import EmbedData, EmbedResponse, EmbedUsage
from src.models.model_config import ModelConfig


class LocalEmbeddingService:
    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._models: dict[str, SentenceTransformer] = {}

    def _resolve(self, model_name: str) -> str:
        """Return local path if the model folder exists, else the HF model ID."""
        local_path = os.path.join(self._model_dir, model_name)
        return local_path if os.path.isdir(local_path) else model_name

    def _get_model(self, model_name: str) -> SentenceTransformer:
        if model_name not in self._models:
            self._models[model_name] = SentenceTransformer(
                self._resolve(model_name), cache_folder=self._model_dir
            )
        return self._models[model_name]

    async def embed(self, model_config: ModelConfig, inputs: list[str]) -> EmbedResponse:
        loop = asyncio.get_event_loop()
        model = self._get_model(model_config.name)
        embeddings = await loop.run_in_executor(
            None, lambda: model.encode(inputs, convert_to_numpy=True).tolist()
        )
        return EmbedResponse(
            model=model_config.name,
            data=[EmbedData(index=i, embedding=emb) for i, emb in enumerate(embeddings)],
            usage=EmbedUsage(total_tokens=sum(len(t.split()) for t in inputs)),
        )
