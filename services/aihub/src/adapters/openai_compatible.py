from typing import Any, AsyncGenerator

import httpx

from src.adapters.base import ChatAdapter
from src.models.chat import ChatChoice, ChatMessage, ChatResponse, ChatUsage
from src.models.model_config import ModelConfig


class OpenAICompatibleChatAdapter(ChatAdapter):
    """
    Handles any provider whose API follows the OpenAI chat completions format.
    Covers: OpenRouter, OpenAI, Together AI, Groq, Mistral, etc.

    The api_key and base_url come from the provider row in the DB (base_url)
    and the PROVIDER_{KEY}_API_KEY environment variable (api_key).
    Each model's endpoint_url overrides base_url when set.
    """

    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _payload(
        self,
        provider_model_id: str,
        messages: list[dict],
        tools: list | None,
        tool_choice: Any | None,
        stream: bool = False,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> dict:
        body: dict[str, Any] = {"model": provider_model_id, "messages": messages}
        if tools:
            body["tools"] = tools
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
        if temperature is not None:
            body["temperature"] = temperature
        if top_p is not None:
            body["top_p"] = top_p
        if top_k is not None:
            body["top_k"] = top_k
        if max_tokens is not None:
            body["max_tokens"] = max_tokens
        if stream:
            body["stream"] = True
            body["stream_options"] = {"include_usage": True}
        return body

    async def chat(
        self,
        config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: Any | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> ChatResponse:
        url = config.endpoint_url or f"{self._base_url}/chat/completions"
        payload = self._payload(config.provider_model_id, messages, tools, tool_choice, temperature=temperature, top_p=top_p, top_k=top_k, max_tokens=max_tokens)

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=self._headers())
            resp.raise_for_status()
            data = resp.json()

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
        return ChatResponse(id=data["id"], model=data["model"], choices=choices, usage=usage)

    async def chat_stream(
        self,
        config: ModelConfig,
        messages: list[dict],
        *,
        tools: list | None = None,
        tool_choice: Any | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[bytes, None]:
        url = config.endpoint_url or f"{self._base_url}/chat/completions"
        payload = self._payload(config.provider_model_id, messages, tools, tool_choice, stream=True, temperature=temperature, top_p=top_p, top_k=top_k, max_tokens=max_tokens)

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", url, json=payload, headers=self._headers()) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes():
                    yield chunk
