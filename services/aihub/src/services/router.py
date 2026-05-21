import json
import time
from decimal import Decimal
from typing import AsyncGenerator

import httpx
from fastapi import HTTPException

from src.adapters.registry import ProviderAdapterRegistry
from src.models.auth import CallerContext
from src.models.chat import ChatResponse
from src.models.embedding import EmbedResponse
from src.models.model_config import ModelConfig, ModelUsageLog
from src.models.rerank import RerankResponse
from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.repositories.providers import ProvidersRepository
from src.services.entitlement import EntitlementGuard


class ServiceRouter:
    def __init__(
        self,
        model_config_repo: ModelConfigRepository,
        model_usage_log_repo: ModelUsageLogRepository,
        entitlement_guard: EntitlementGuard,
        registry: ProviderAdapterRegistry,
        providers_repo: ProvidersRepository | None = None,
        encryption_key: str | None = None,
    ) -> None:
        self._model_config_repo = model_config_repo
        self._model_usage_log_repo = model_usage_log_repo
        self._entitlement_guard = entitlement_guard
        self._registry = registry
        self._providers_repo = providers_repo
        self._encryption_key = encryption_key

    async def _refresh_adapter(self, provider_key: str) -> None:
        """Re-fetch provider row from DB and rebuild its adapter in-place."""
        if self._providers_repo is None:
            return
        row = await self._providers_repo.get_by_key(provider_key)
        if row:
            self._registry.refresh_provider(row, self._encryption_key)

    async def _get_model(self, model_key: str, operation_type: str) -> ModelConfig:
        config = await self._model_config_repo.get_by_model_key_and_operation(
            model_key, operation_type
        )
        if config is None:
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_key}' not found for operation '{operation_type}' or is inactive",
            )
        return config

    async def _log_usage(self, log: ModelUsageLog) -> None:
        try:
            await self._model_usage_log_repo.create(log)
        except Exception:
            pass

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
            cost += config.input_cost * input_tokens / Decimal(1_000_000)
        if config.output_cost and output_tokens:
            cost += config.output_cost * output_tokens / Decimal(1_000_000)
        return cost

    def _base_log(self, config: ModelConfig, ctx: CallerContext) -> dict:
        return dict(
            tenant_id=ctx.tenant_id,
            workspace_id=ctx.workspace_id,
            user_id=ctx.user_id,
            service_client_id=ctx.service_client_id,
            model_id=config.id,
            model_key=config.model_key,
            operation_type=config.operation_type,
        )

    # ── Chat ──────────────────────────────────────────────────────────────────

    async def chat(
        self,
        model_key: str,
        messages: list[dict],
        ctx: CallerContext,
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> ChatResponse:
        config = await self._get_model(model_key, "chat")
        try:
            await self._entitlement_guard.check_before_call(
                ctx.tenant_id, config.model_key, config.operation_type, ctx.bearer_token
            )
        except HTTPException as exc:
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=0,
                status="rejected",
                error_message=exc.detail,
            ))
            raise

        adapter = self._registry.get_chat(config.provider_key)
        start = time.monotonic()
        try:
            result = await adapter.chat(config, messages, tools=tools, tool_choice=tool_choice, temperature=temperature, top_p=top_p, top_k=top_k, max_tokens=max_tokens)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 401:
                # Key may have been set/rotated after startup — refresh from DB and retry once.
                await self._refresh_adapter(config.provider_key)
                adapter = self._registry.get_chat(config.provider_key)
                try:
                    result = await adapter.chat(config, messages, tools=tools, tool_choice=tool_choice, temperature=temperature, top_p=top_p, top_k=top_k, max_tokens=max_tokens)
                except Exception as retry_exc:
                    latency_ms = int((time.monotonic() - start) * 1000)
                    await self._log_usage(ModelUsageLog(
                        **self._base_log(config, ctx),
                        latency_ms=latency_ms,
                        status="failed",
                        error_message=str(retry_exc),
                    ))
                    raise
            else:
                latency_ms = int((time.monotonic() - start) * 1000)
                await self._log_usage(ModelUsageLog(
                    **self._base_log(config, ctx),
                    latency_ms=latency_ms,
                    status="failed",
                    error_message=str(exc),
                ))
                raise
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=latency_ms,
                status="failed",
                error_message=str(exc),
            ))
            raise

        latency_ms = int((time.monotonic() - start) * 1000)
        input_t = result.usage.prompt_tokens if result.usage else None
        output_t = result.usage.completion_tokens if result.usage else None
        total_t = (input_t or 0) + (output_t or 0)

        await self._entitlement_guard.record_usage(
            ctx.tenant_id, config.model_key, config.operation_type, total_t
        )
        await self._log_usage(ModelUsageLog(
            **self._base_log(config, ctx),
            input_tokens=input_t,
            output_tokens=output_t,
            cost=self._compute_cost(config, input_t, output_t),
            latency_ms=latency_ms,
            status="success",
        ))

        return result

    async def chat_stream(
        self,
        model_key: str,
        messages: list[dict],
        ctx: CallerContext,
        *,
        tools: list | None = None,
        tool_choice: str | dict | None = None,
        temperature: float | None = None,
        top_p: float | None = None,
        top_k: int | None = None,
        max_tokens: int | None = None,
    ) -> AsyncGenerator[bytes, None]:
        config = await self._get_model(model_key, "chat")
        try:
            await self._entitlement_guard.check_before_call(
                ctx.tenant_id, config.model_key, config.operation_type, ctx.bearer_token
            )
        except HTTPException as exc:
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=0,
                status="rejected",
                error_message=exc.detail,
            ))
            raise

        adapter = self._registry.get_chat(config.provider_key)
        raw = adapter.chat_stream(config, messages, tools=tools, tool_choice=tool_choice, temperature=temperature, top_p=top_p, top_k=top_k, max_tokens=max_tokens)
        return self._wrap_stream_with_usage(raw, config, ctx)

    async def _wrap_stream_with_usage(
        self,
        raw: AsyncGenerator[bytes, None],
        config: ModelConfig,
        ctx: CallerContext,
    ) -> AsyncGenerator[bytes, None]:
        leftover = ""
        last_usage: dict | None = None
        start = time.monotonic()
        stream_failed = False
        error_message: str | None = None
        try:
            async for chunk in raw:
                yield chunk
                text = leftover + chunk.decode("utf-8", errors="replace")
                lines = text.split("\n")
                leftover = lines[-1]
                for line in lines[:-1]:
                    if line.startswith("data: ") and line != "data: [DONE]":
                        try:
                            data = json.loads(line[6:])
                            if data.get("usage"):
                                last_usage = data["usage"]
                        except Exception:
                            pass
        except Exception as exc:
            stream_failed = True
            error_message = str(exc)
            # On 401 refresh the adapter so the next request picks up the latest key.
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 401:
                await self._refresh_adapter(config.provider_key)
            raise
        finally:
            latency_ms = int((time.monotonic() - start) * 1000)
            input_t = last_usage.get("prompt_tokens") if last_usage else None
            output_t = last_usage.get("completion_tokens") if last_usage else None
            total_t = (input_t or 0) + (output_t or 0)

            await self._entitlement_guard.record_usage(
                ctx.tenant_id, config.model_key, config.operation_type, total_t
            )
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                input_tokens=input_t,
                output_tokens=output_t,
                cost=self._compute_cost(config, input_t, output_t),
                latency_ms=latency_ms,
                status="failed" if stream_failed else "success",
                error_message=error_message,
            ))

    # ── Embed ─────────────────────────────────────────────────────────────────

    async def embed(
        self,
        model_key: str,
        inputs: list[str],
        ctx: CallerContext,
    ) -> EmbedResponse:
        config = await self._get_model(model_key, "embed")
        try:
            await self._entitlement_guard.check_before_call(
                ctx.tenant_id, config.model_key, config.operation_type, ctx.bearer_token
            )
        except HTTPException as exc:
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=0,
                status="rejected",
                error_message=exc.detail,
            ))
            raise

        adapter = self._registry.get_embed(config.provider_key)
        start = time.monotonic()
        try:
            result = await adapter.embed(config, inputs)
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=latency_ms,
                status="failed",
                error_message=str(exc),
            ))
            raise

        latency_ms = int((time.monotonic() - start) * 1000)
        total_t = result.usage.total_tokens or 0 if result.usage else 0
        await self._entitlement_guard.record_usage(
            ctx.tenant_id, config.model_key, config.operation_type, total_t
        )
        await self._log_usage(ModelUsageLog(
            **self._base_log(config, ctx),
            input_tokens=total_t,
            latency_ms=latency_ms,
            status="success",
        ))
        return result

    # ── Rerank ────────────────────────────────────────────────────────────────

    async def rerank(
        self,
        model_key: str,
        query: str,
        documents: list[str],
        top_n: int | None,
        ctx: CallerContext,
    ) -> RerankResponse:
        config = await self._get_model(model_key, "rerank")
        try:
            await self._entitlement_guard.check_before_call(
                ctx.tenant_id, config.model_key, config.operation_type, ctx.bearer_token
            )
        except HTTPException as exc:
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=0,
                status="rejected",
                error_message=exc.detail,
            ))
            raise

        adapter = self._registry.get_rerank(config.provider_key)
        start = time.monotonic()
        try:
            result = await adapter.rerank(config, query, documents, top_n)
        except Exception as exc:
            latency_ms = int((time.monotonic() - start) * 1000)
            await self._log_usage(ModelUsageLog(
                **self._base_log(config, ctx),
                latency_ms=latency_ms,
                status="failed",
                error_message=str(exc),
            ))
            raise

        latency_ms = int((time.monotonic() - start) * 1000)
        await self._entitlement_guard.record_usage(
            ctx.tenant_id, config.model_key, config.operation_type, len(documents)
        )
        await self._log_usage(ModelUsageLog(
            **self._base_log(config, ctx),
            input_tokens=len(documents),
            latency_ms=latency_ms,
            status="success",
        ))
        return result
