from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID


@dataclass
class ModelConfig:
    id: UUID
    name: str
    task_type: str
    provider: str
    endpoint_url: str | None
    input_cost: Decimal | None
    output_cost: Decimal | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


@dataclass
class ModelUsageLog:
    model_id: UUID
    input_tokens: int | None
    output_tokens: int | None
    cost: Decimal | None
    status: str
