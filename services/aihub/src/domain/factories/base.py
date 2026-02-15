from abc import ABC, abstractmethod
from src.domain.models.base import BaseModel


class BaseModelFactory(ABC):
    @abstractmethod
    def create(self, model_config: dict) -> BaseModel:
        pass
    