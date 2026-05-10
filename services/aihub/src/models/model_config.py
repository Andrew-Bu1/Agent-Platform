from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


@dataclass
class ModelConfig:
    id: UUID
    provider_key: str       # resolved via JOIN with providers
    model_key: str
    display_name: str
    description: str | None
    provider_model_id: str  # actual model ID sent to the provider (e.g. "anthropic/claude-3-5-sonnet")
    operation_type: str     # chat | embed | rerank
    task_type: str | None
    endpoint_url: str | None
    input_cost: Decimal | None
    output_cost: Decimal | None
    context_window_tokens: int | None
    max_output_tokens: int | None
    embedding_dimensions: int | None
    supports_streaming: bool
    supports_tools: bool
    supports_json_mode: bool
    supports_vision: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class ModelUsageLog:
    tenant_id: UUID
    model_id: UUID
    model_key: str
    operation_type: str
    status: str             # success | failed | rejected | timeout
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost: Decimal | None = None
    workspace_id: UUID | None = None
    user_id: UUID | None = None
    service_client_id: UUID | None = None
    feature_key: str | None = None
    error_message: str | None = None
    latency_ms: int | None = None
