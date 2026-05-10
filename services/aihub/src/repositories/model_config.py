from decimal import Decimal
from uuid import UUID

from common.postgres import PostgresClient

from src.models.model_config import ModelConfig

_SELECT = """
    SELECT
        mc.id,
        p.provider_key,
        mc.model_key,
        mc.display_name,
        mc.description,
        mc.provider_model_id,
        mc.operation_type,
        mc.task_type,
        mc.endpoint_url,
        mc.input_cost,
        mc.output_cost,
        mc.context_window_tokens,
        mc.max_output_tokens,
        mc.embedding_dimensions,
        mc.supports_streaming,
        mc.supports_tools,
        mc.supports_json_mode,
        mc.supports_vision,
        mc.is_active,
        mc.created_at,
        mc.updated_at
    FROM model_configs mc
    JOIN providers p ON p.id = mc.provider_id
"""


def _row_to_model(row) -> ModelConfig:
    return ModelConfig(
        id=row["id"],
        provider_key=row["provider_key"],
        model_key=row["model_key"],
        display_name=row["display_name"],
        description=row["description"],
        provider_model_id=row["provider_model_id"],
        operation_type=row["operation_type"],
        task_type=row["task_type"],
        endpoint_url=row["endpoint_url"],
        input_cost=row["input_cost"],
        output_cost=row["output_cost"],
        context_window_tokens=row["context_window_tokens"],
        max_output_tokens=row["max_output_tokens"],
        embedding_dimensions=row["embedding_dimensions"],
        supports_streaming=row["supports_streaming"],
        supports_tools=row["supports_tools"],
        supports_json_mode=row["supports_json_mode"],
        supports_vision=row["supports_vision"],
        is_active=row["is_active"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class ModelConfigRepository:
    def __init__(self, db: PostgresClient) -> None:
        self._db = db

    async def get_by_model_key_and_operation(
        self, model_key: str, operation_type: str
    ) -> ModelConfig | None:
        rows = await self._db.fetch(
            f"{_SELECT} WHERE mc.model_key = $1 AND mc.operation_type = $2 AND mc.is_active = TRUE",
            model_key,
            operation_type,
        )
        return _row_to_model(rows[0]) if rows else None

    async def get_by_id(self, id: UUID) -> ModelConfig | None:
        rows = await self._db.fetch(f"{_SELECT} WHERE mc.id = $1", id)
        return _row_to_model(rows[0]) if rows else None

    async def list(
        self,
        operation_type: str | None = None,
        provider_key: str | None = None,
    ) -> list[ModelConfig]:
        conditions: list[str] = []
        args: list = []

        if operation_type is not None:
            args.append(operation_type)
            conditions.append(f"mc.operation_type = ${len(args)}")
        if provider_key is not None:
            args.append(provider_key)
            conditions.append(f"p.provider_key = ${len(args)}")

        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._db.fetch(
            f"{_SELECT}{where} ORDER BY mc.created_at DESC", *args
        )
        return [_row_to_model(r) for r in rows]

    async def create(
        self,
        id: UUID,
        provider_id: UUID,
        model_key: str,
        display_name: str,
        provider_model_id: str,
        operation_type: str,
        description: str | None = None,
        task_type: str | None = None,
        endpoint_url: str | None = None,
        input_cost: Decimal | None = None,
        output_cost: Decimal | None = None,
        context_window_tokens: int | None = None,
        max_output_tokens: int | None = None,
        embedding_dimensions: int | None = None,
        supports_streaming: bool = False,
        supports_tools: bool = False,
        supports_json_mode: bool = False,
        supports_vision: bool = False,
    ) -> ModelConfig:
        await self._db.execute(
            """
            INSERT INTO model_configs (
                id, provider_id, model_key, display_name, description, provider_model_id,
                operation_type, task_type, endpoint_url,
                input_cost, output_cost,
                context_window_tokens, max_output_tokens, embedding_dimensions,
                supports_streaming, supports_tools, supports_json_mode, supports_vision
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11,
                $12, $13, $14,
                $15, $16, $17, $18
            )
            """,
            id, provider_id, model_key, display_name, description, provider_model_id,
            operation_type, task_type, endpoint_url,
            input_cost, output_cost,
            context_window_tokens, max_output_tokens, embedding_dimensions,
            supports_streaming, supports_tools, supports_json_mode, supports_vision,
        )
        result = await self.get_by_id(id)
        assert result is not None
        return result

    async def update(
        self,
        id: UUID,
        display_name: str | None = None,
        description: str | None = None,
        endpoint_url: str | None = None,
        input_cost: Decimal | None = None,
        output_cost: Decimal | None = None,
        context_window_tokens: int | None = None,
        max_output_tokens: int | None = None,
        supports_streaming: bool | None = None,
        supports_tools: bool | None = None,
        supports_json_mode: bool | None = None,
        supports_vision: bool | None = None,
        is_active: bool | None = None,
    ) -> ModelConfig | None:
        fields: list[str] = []
        args: list = []

        for col, val in [
            ("display_name", display_name),
            ("description", description),
            ("endpoint_url", endpoint_url),
            ("input_cost", input_cost),
            ("output_cost", output_cost),
            ("context_window_tokens", context_window_tokens),
            ("max_output_tokens", max_output_tokens),
            ("supports_streaming", supports_streaming),
            ("supports_tools", supports_tools),
            ("supports_json_mode", supports_json_mode),
            ("supports_vision", supports_vision),
            ("is_active", is_active),
        ]:
            if val is not None:
                args.append(val)
                fields.append(f"{col} = ${len(args)}")

        if not fields:
            return await self.get_by_id(id)

        args.append(id)
        await self._db.execute(
            f"UPDATE model_configs SET {', '.join(fields)}, updated_at = NOW() "
            f"WHERE id = ${len(args)}",
            *args,
        )
        return await self.get_by_id(id)

    async def delete(self, id: UUID) -> bool:
        result = await self._db.execute(
            "DELETE FROM model_configs WHERE id = $1", id
        )
        return result.split()[-1] != "0"
