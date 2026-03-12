import asyncio
import os

from sentence_transformers import CrossEncoder

from src.models.model_config import ModelConfig
from src.models.rerank import RerankResponse, RerankResult


class LocalRerankService:
    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._models: dict[str, CrossEncoder] = {}

    def _resolve(self, model_name: str) -> str:
        """Return local path if the model folder exists, else the HF model ID."""
        local_path = os.path.join(self._model_dir, model_name)
        return local_path if os.path.isdir(local_path) else model_name

    def _get_model(self, model_name: str) -> CrossEncoder:
        if model_name not in self._models:
            self._models[model_name] = CrossEncoder(self._resolve(model_name))
        return self._models[model_name]

    async def rerank(
        self,
        model_config: ModelConfig,
        query: str,
        documents: list[str],
        top_n: int | None,
    ) -> RerankResponse:
        loop = asyncio.get_event_loop()
        model = self._get_model(model_config.name)
        pairs = [(query, doc) for doc in documents]
        scores: list[float] = await loop.run_in_executor(
            None, lambda: model.predict(pairs).tolist()
        )
        results = [
            RerankResult(index=i, document=doc, relevance_score=score)
            for i, (doc, score) in enumerate(zip(documents, scores))
        ]
        results.sort(key=lambda r: r.relevance_score, reverse=True)
        if top_n is not None:
            results = results[:top_n]
        return RerankResponse(model=model_config.name, results=results)
