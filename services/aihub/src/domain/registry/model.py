from src.domain.factories.base import BaseModelFactory

class ModelRegistry:

    def __init__(self):
        self._factories: dict[str, BaseModelFactory] = {}

    def register(self, task_type: str, factory: BaseModelFactory) -> None:
        self._factories[task_type] = factory

    def get_factory(self, task_type: str) -> BaseModelFactory:
        if task_type not in self._factories:
            raise ValueError(f"Factory for {task_type} not found")
        return self._factories[task_type]
        