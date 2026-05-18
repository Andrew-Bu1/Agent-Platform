from abc import ABC, abstractmethod
from typing import AsyncGenerator

from src.models.chat import ChatResponse
from src.models.embedding import EmbedResponse
from src.models.model_config import ModelConfig
from src.models.rerank import RerankResponse


class ChatAdapter(ABC):
    @abstractmethod
    async def chat(
        self,
        config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> ChatResponse: ...

    @abstractmethod
    def chat_stream(
        self,
        config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[bytes, None]: ...


class EmbedAdapter(ABC):
    @abstractmethod
    async def embed(self, config: ModelConfig, inputs: list[str]) -> EmbedResponse: ...


class RerankAdapter(ABC):
    @abstractmethod
    async def rerank(
        self,
        config: ModelConfig,
        query: str,
        documents: list[str],
        top_n: int | None,
    ) -> RerankResponse: ...
