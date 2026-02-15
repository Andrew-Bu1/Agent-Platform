from .base import BaseModel


class RerankModel(BaseModel):
    def rerank(self, query: str, documents: list[str]) -> list[dict]:
        if not self._is_loaded:
            raise RuntimeError("Model not loaded")

        return self.predict((query, documents))

    def predict(self, input: tuple[str, list[str]]) -> list[dict]:
        """
        Should return documents with scores.
        Example:
        [
            {"document": "...", "score": 0.92},
            ...
        ]
        """
        raise NotImplementedError
