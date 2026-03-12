from typing import Any, AsyncGenerator

import httpx

from common.config import OpenRouterConfig

from src.models.chat import ChatChoice, ChatMessage, ChatResponse, ChatUsage
from src.models.model_config import ModelConfig


class OpenRouterChatService:
    def __init__(self, config: OpenRouterConfig) -> None:
        self._config = config

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(
        self,
        model_name: str,
        messages: list[dict],
        tools: list | None,
        tool_choice: Any | None,
        stream: bool = False,
    ) -> dict:
        payload: dict[str, Any] = {"model": model_name, "messages": messages}
        if tools:
            payload["tools"] = tools
        if tool_choice is not None:
            payload["tool_choice"] = tool_choice
        if stream:
            payload["stream"] = True
            payload["stream_options"] = {"include_usage": True}
        return payload

    async def chat(
        self,
        model_config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: Any | None = None,
    ) -> ChatResponse:
        url = model_config.endpoint_url or f"{self._config.base_url}/chat/completions"
        payload = self._build_payload(model_config.name, messages, tools, tool_choice)

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, json=payload, headers=self._headers())
            response.raise_for_status()
            data = response.json()

        choices = [
            ChatChoice(
                index=c["index"],
                message=ChatMessage(
                    role=c["message"]["role"],
                    content=c["message"].get("content"),
                    tool_calls=c["message"].get("tool_calls"),
                ),
                finish_reason=c.get("finish_reason"),
            )
            for c in data["choices"]
        ]

        usage = None
        if "usage" in data:
            u = data["usage"]
            usage = ChatUsage(
                prompt_tokens=u.get("prompt_tokens"),
                completion_tokens=u.get("completion_tokens"),
                total_tokens=u.get("total_tokens"),
            )

        return ChatResponse(
            id=data["id"],
            model=data["model"],
            choices=choices,
            usage=usage,
        )

    async def chat_stream(
        self,
        model_config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: Any | None = None,
    ) -> AsyncGenerator[bytes, None]:
        """Stream SSE chunks straight from OpenRouter to the caller."""
        url = model_config.endpoint_url or f"{self._config.base_url}/chat/completions"
        payload = self._build_payload(model_config.name, messages, tools, tool_choice, stream=True)

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", url, json=payload, headers=self._headers()
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes():
                    yield chunk
