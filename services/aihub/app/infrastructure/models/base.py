from abc import ABC, abstractmethod
import logging

class BaseModel(ABC):
    def __init__(
        self, 
        model_name: str,
        device: str = "cpu",
    ):
        self.model_name = model_name
        self.device = device
        self._logger = logging.getLogger(self.__class__.__name__)

    @abstractmethod
    def load(self) -> None:
        """Load the model into memory."""
        pass

    @abstractmethod
    def unload(self) -> None:
        """Unload the model from memory."""
        pass

    @property
    def is_loaded(self) -> bool:
        """Check if the model is loaded."""
        return self._model is not None
    
    @property
    @abstractmethod
    def model_id(self) -> str:
        """Return the unique identifier of the model."""
        pass