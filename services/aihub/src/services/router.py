import json
from decimal import Decimal
from typing import AsyncGenerator, Any

from fastapi import HTTPException

from common.config import OpenRouterConfig

from src.models.chat import ChatResponse
from src.models.embedding import EmbedResponse
from src.models.model_config import ModelConfig, ModelUsageLog
from src.models.rerank import RerankResponse
from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.services.api.chat import OpenRouterChatService
from src.services.local.embedding import LocalEmbeddingService
from src.services.local.rerank import LocalRerankService


class ServiceRouter:
    def __init__(
        self,
        model_config_repo: ModelConfigRepository,
        model_usage_log_repo: ModelUsageLogRepository,
        open_router_config: OpenRouterConfig,
        model_dir: str = ".models",
    ) -> None:
        self._model_config_repo = model_config_repo
        self._model_usage_log_repo = model_usage_log_repo
        self._api_chat = OpenRouterChatService(open_router_config)
        self._local_embed = LocalEmbeddingService(model_dir)
        self._local_rerank = LocalRerankService(model_dir)

    async def _get_model(self, name: str) -> ModelConfig:
        config = await self._model_config_repo.get_by_name(name)
        if config is None:
            raise HTTPException(status_code=404, detail=f"Model '{name}' not found or is inactive")
        return config

    async def _log_usage(self, log: ModelUsageLog) -> None:
        try:
            await self._model_usage_log_repo.create(log)
        except Exception:
            pass  # usage logging is best-effort

    def _compute_cost(
        self,
        config: ModelConfig,
        input_tokens: int | None,
        output_tokens: int | None,
    ) -> Decimal | None:
        if config.input_cost is None and config.output_cost is None:
            return None
        cost = Decimal(0)
        if config.input_cost and input_tokens:
            cost += config.input_cost * input_tokens
        if config.output_cost and output_tokens:
            cost += config.output_cost * output_tokens
        return cost

    async def chat(
        self,
        model_name: str,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
    ) -> ChatResponse:
        config = await self._get_model(model_name)

        if config.provider == "openrouter":
            result = await self._api_chat.chat(config, messages, tools=tools, tool_choice=tool_choice)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider '{config.provider}' for chat",
            )

        if result.usage:
            await self._log_usage(
                ModelUsageLog(
                    model_id=config.id,
                    input_tokens=result.usage.prompt_tokens,
                    output_tokens=result.usage.completion_tokens,
                    cost=self._compute_cost(
                        config,
                        result.usage.prompt_tokens,
                        result.usage.completion_tokens,
                    ),
                    status="success",
                )
            )

        return result

    async def chat_stream(
        self,
        model_name: str,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
    ) -> AsyncGenerator[bytes, None]:
        config = await self._get_model(model_name)

        if config.provider != "openrouter":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider '{config.provider}' for streaming chat",
            )

        raw = self._api_chat.chat_stream(config, messages, tools=tools, tool_choice=tool_choice)
        return self._wrap_stream_with_usage(raw, config)

    async def _wrap_stream_with_usage(
        self,
        raw: AsyncGenerator[bytes, None],
        config: ModelConfig,
    ) -> AsyncGenerator[bytes, None]:
        """Pass-through stream that captures the SSE usage chunk and logs it after done."""
        leftover = ""
        last_usage: dict | None = None
        try:
            async for chunk in raw:
                yield chunk
                # Parse SSE lines incrementally — only to capture the usage object.
                text = leftover + chunk.decode("utf-8", errors="replace")
                lines = text.split("\n")
                leftover = lines[-1]  # last element may be incomplete
                for line in lines[:-1]:
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            data = json.loads(line[6:])
                            if data.get("usage"):
                                last_usage = data["usage"]
                        except Exception:
                            pass
        finally:
            if last_usage:
                input_t = last_usage.get("prompt_tokens")
                output_t = last_usage.get("completion_tokens")
                await self._log_usage(
                    ModelUsageLog(
                        model_id=config.id,
                        input_tokens=input_t,
                        output_tokens=output_t,
                        cost=self._compute_cost(config, input_t, output_t),
                        status="success",
                    )
                )

    async def embed(self, model_name: str, inputs: list[str]) -> EmbedResponse:
        config = await self._get_model(model_name)

        if config.provider == "self-host":
            result = await self._local_embed.embed(config, inputs)
        elif config.provider == "openrouter":
            raise HTTPException(status_code=501, detail="OpenRouter embedding not yet implemented")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider '{config.provider}' for embedding",
            )

        await self._log_usage(
            ModelUsageLog(
                model_id=config.id,
                input_tokens=sum(len(t.split()) for t in inputs),
                output_tokens=None,
                cost=None,
                status="success",
            )
        )
        return result

    async def rerank(
        self,
        model_name: str,
        query: str,
        documents: list[str],
        top_n: int | None,
    ) -> RerankResponse:
        config = await self._get_model(model_name)

        if config.provider == "self-host":
            result = await self._local_rerank.rerank(config, query, documents, top_n)
        elif config.provider == "openrouter":
            raise HTTPException(status_code=501, detail="OpenRouter reranking not yet implemented")
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider '{config.provider}' for reranking",
            )

        await self._log_usage(
            ModelUsageLog(
                model_id=config.id,
                input_tokens=len(documents),
                output_tokens=None,
                cost=None,
                status="success",
            )
        )
        return result
