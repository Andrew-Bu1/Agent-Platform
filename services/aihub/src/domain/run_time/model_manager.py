from collections import OrderedDict
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from src.application.repositories.model_config import ModelConfigRepository

from src.domain.models.base import BaseModel
from src.domain.registry.model import ModelRegistry

class ModelManager:

    def __init__(
        self, 
        model_registry: ModelRegistry,
        model_config_repository: "ModelConfigRepository",
        max_loaded_models: int = 3,
        ):
        self._model_registry = model_registry
        self._model_config_repository = model_config_repository
        self._max_loaded_models = max_loaded_models
        self._loaded_models: OrderedDict[str, BaseModel] = OrderedDict()

    async def get_model(self, model_id: str) -> BaseModel:
        if model_id in self._loaded_models:
            model = self._loaded_models.pop(model_id)
            self._loaded_models[model_id] = model
            return model

        return await self._load_model(model_id)

    async def _load_model(self, model_id: str) -> BaseModel:
        
        if len(self._loaded_models) >= self._max_loaded_models:
            oldest_model_id, oldest_model = self._loaded_models.popitem(last=False)
            oldest_model.unload()

        config = await self._model_config_repository.get_model_config(model_id)
        if not config:
            raise ValueError(f"Model config not found for {model_id}")

        task_type = config["task_type"]
        provider = config["provider"]
        model_name = config["model_id"]
        
        factory = self._model_registry.get_factory(task_type)
        model = factory.create(
            model_config={
                "provider": provider,
                "model_id": model_name,
                "device": "cpu",
            }
        )
        model.load()
        self._loaded_models[model_id] = model
        return model

    def unload(self, model_id: str):
        model = self._loaded_models.pop(model_id)
        if model:
            model.unload()