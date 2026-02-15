from .base import BaseModel


class EmbeddingModel(BaseModel):
    def embed(self, texts: str | list[str]) -> list[list[float]]:
        if not self._is_loaded:
            raise RuntimeError("Model not loaded")

        return self.predict(texts)

    def predict(self, input: str | list[str]) -> list[list[float]]:
        """
        Default behavior calls embed logic.
        Concrete implementations override this.
        """
        raise NotImplementedError
