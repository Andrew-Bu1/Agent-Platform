from fastapi import HTTPException

from src.adapters.base import ChatAdapter, EmbedAdapter, RerankAdapter
from src.adapters.local import LocalEmbedAdapter, LocalRerankAdapter
from src.adapters.openai_compatible import OpenAICompatibleChatAdapter
from src.utils.crypto import decrypt


class ProviderAdapterRegistry:
    def __init__(self) -> None:
        self._chat: dict[str, ChatAdapter] = {}
        self._embed: dict[str, EmbedAdapter] = {}
        self._rerank: dict[str, RerankAdapter] = {}

    def get_chat(self, provider_key: str) -> ChatAdapter:
        adapter = self._chat.get(provider_key)
        if adapter is None:
            raise HTTPException(status_code=400, detail=f"Provider '{provider_key}' does not support chat")
        return adapter

    def get_embed(self, provider_key: str) -> EmbedAdapter:
        adapter = self._embed.get(provider_key)
        if adapter is None:
            raise HTTPException(status_code=400, detail=f"Provider '{provider_key}' does not support embedding")
        return adapter

    def get_rerank(self, provider_key: str) -> RerankAdapter:
        adapter = self._rerank.get(provider_key)
        if adapter is None:
            raise HTTPException(status_code=400, detail=f"Provider '{provider_key}' does not support reranking")
        return adapter


def build_registry(
    provider_rows: list,
    model_dir: str = ".models",
    encryption_key: str | None = None,
) -> ProviderAdapterRegistry:
    registry = ProviderAdapterRegistry()

    # Shared local adapters — lazy-load models on first use, not at startup.
    local_embed = LocalEmbedAdapter(model_dir)
    local_rerank = LocalRerankAdapter(model_dir)

    for row in provider_rows:
        key: str = row.provider_key
        adapter_type: str = row.adapter_type

        if adapter_type == "openai_compatible":
            encrypted = (row.config_json or {}).get("api_key", "")
            if encrypted and encryption_key:
                api_key = decrypt(encryption_key, encrypted)
            else:
                api_key = ""
            base_url = row.base_url or ""
            registry._chat[key] = OpenAICompatibleChatAdapter(base_url, api_key)

        elif adapter_type == "local":
            registry._embed[key] = local_embed
            registry._rerank[key] = local_rerank

    return registry
