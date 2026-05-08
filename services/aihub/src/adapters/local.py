import asyncio
import os

from sentence_transformers import CrossEncoder, SentenceTransformer

from src.adapters.base import EmbedAdapter, RerankAdapter
from src.models.embedding import EmbedData, EmbedResponse, EmbedUsage
from src.models.model_config import ModelConfig
from src.models.rerank import RerankResponse, RerankResult


class LocalEmbedAdapter(EmbedAdapter):
    """
    Runs embedding models in-process via SentenceTransformer.
    Models are lazy-loaded and cached in memory by model_key.
    Looks for a local directory at {model_dir}/{model_key} first,
    then falls back to provider_model_id as the HuggingFace Hub ID.
    """

    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._models: dict[str, SentenceTransformer] = {}

    def _load(self, config: ModelConfig) -> SentenceTransformer:
        if config.model_key not in self._models:
            local = os.path.join(self._model_dir, config.model_key)
            path = local if os.path.isdir(local) else config.provider_model_id
            self._models[config.model_key] = SentenceTransformer(path, cache_folder=self._model_dir)
        return self._models[config.model_key]

    async def embed(self, config: ModelConfig, inputs: list[str]) -> EmbedResponse:
        model = self._load(config)
        loop = asyncio.get_event_loop()
        embeddings = await loop.run_in_executor(
            None, lambda: model.encode(inputs, convert_to_numpy=True).tolist()
        )
        return EmbedResponse(
            model=config.model_key,
            data=[EmbedData(index=i, embedding=emb) for i, emb in enumerate(embeddings)],
            usage=EmbedUsage(total_tokens=sum(len(t.split()) for t in inputs)),
        )


class LocalRerankAdapter(RerankAdapter):
    """
    Runs reranking models in-process via CrossEncoder.
    Same local-first resolution as LocalEmbedAdapter.
    """

    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._models: dict[str, CrossEncoder] = {}

    def _load(self, config: ModelConfig) -> CrossEncoder:
        if config.model_key not in self._models:
            local = os.path.join(self._model_dir, config.model_key)
            path = local if os.path.isdir(local) else config.provider_model_id
            self._models[config.model_key] = CrossEncoder(path)
        return self._models[config.model_key]

    async def rerank(
        self,
        config: ModelConfig,
        query: str,
        documents: list[str],
        top_n: int | None,
    ) -> RerankResponse:
        model = self._load(config)
        loop = asyncio.get_event_loop()
        pairs = [(query, doc) for doc in documents]
        scores: list[float] = await loop.run_in_executor(None, lambda: model.predict(pairs).tolist())
        results = [
            RerankResult(index=i, document=doc, relevance_score=score)
            for i, (doc, score) in enumerate(zip(documents, scores))
        ]
        results.sort(key=lambda r: r.relevance_score, reverse=True)
        if top_n is not None:
            results = results[:top_n]
        return RerankResponse(model=config.model_key, results=results)
