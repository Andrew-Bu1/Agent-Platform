from src.domain.run_time.model_manager import ModelManager

class EmbeddingService:
    def __init__(self, model_manager: ModelManager):
        self._model_manager = model_manager

    async def embed(self, model_id: str, input: list[str] | str):
        model = await self._model_manager.get_model(model_id)
        return model.embed(input)