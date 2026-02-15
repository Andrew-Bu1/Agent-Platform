from abc import ABC, abstractmethod
from typing import Any


class BaseModel(ABC):
    def __init__(self, model_id: str, device: str = "cpu"):
        self.model_id = model_id
        self.device = device
        self._is_loaded = False

    @abstractmethod
    def load(self) -> None:
        """Load model into memory"""
        pass

    @abstractmethod
    def unload(self) -> None:
        """Unload model from memory"""
        pass

    @abstractmethod
    def predict(self, input: Any) -> Any:
        """Generic prediction method"""
        pass

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded
