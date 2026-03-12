from decimal import Decimal
from uuid import UUID

from common.postgres import PostgresClient

from src.models.model_config import ModelConfig

_SELECT = (
    "SELECT id, name, task_type, provider, endpoint_url, "
    "input_cost, output_cost, is_active, created_at, updated_at "
    "FROM model_configs"
)


def _row_to_model(row) -> ModelConfig:
    return ModelConfig(
        id=row["id"],
        name=row["name"],
        task_type=row["task_type"],
        provider=row["provider"],
        endpoint_url=row["endpoint_url"],
        input_cost=row["input_cost"],
        output_cost=row["output_cost"],
        is_active=row["is_active"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class ModelConfigRepository:
    def __init__(self, db: PostgresClient) -> None:
        self._db = db

    async def get_by_name(self, name: str) -> ModelConfig | None:
        rows = await self._db.fetch(
            f"{_SELECT} WHERE name = $1 AND is_active = TRUE",
            name,
        )
        return _row_to_model(rows[0]) if rows else None

    async def get_by_id(self, id: UUID) -> ModelConfig | None:
        rows = await self._db.fetch(f"{_SELECT} WHERE id = $1", id)
        return _row_to_model(rows[0]) if rows else None

    async def list(
        self,
        task_type: str | None = None,
        provider: str | None = None,
    ) -> list[ModelConfig]:
        conditions: list[str] = []
        args: list = []

        if task_type is not None:
            args.append(task_type)
            conditions.append(f"task_type = ${len(args)}")
        if provider is not None:
            args.append(provider)
            conditions.append(f"provider = ${len(args)}")

        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = await self._db.fetch(f"{_SELECT}{where} ORDER BY created_at DESC", *args)
        return [_row_to_model(r) for r in rows]

    async def create(
        self,
        id: UUID,
        name: str,
        task_type: str,
        provider: str,
        endpoint_url: str | None,
        input_cost: Decimal | None,
        output_cost: Decimal | None,
    ) -> ModelConfig:
        rows = await self._db.fetch(
            "INSERT INTO model_configs "
            "(id, name, task_type, provider, endpoint_url, input_cost, output_cost) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) "
            "RETURNING id, name, task_type, provider, endpoint_url, "
            "input_cost, output_cost, is_active, created_at, updated_at",
            id, name, task_type, provider, endpoint_url, input_cost, output_cost,
        )
        return _row_to_model(rows[0])

    async def update(
        self,
        id: UUID,
        name: str | None = None,
        task_type: str | None = None,
        provider: str | None = None,
        endpoint_url: str | None = None,
        input_cost: Decimal | None = None,
        output_cost: Decimal | None = None,
        is_active: bool | None = None,
    ) -> ModelConfig | None:
        fields: list[str] = []
        args: list = []

        for col, val in [
            ("name", name),
            ("task_type", task_type),
            ("provider", provider),
            ("endpoint_url", endpoint_url),
            ("input_cost", input_cost),
            ("output_cost", output_cost),
            ("is_active", is_active),
        ]:
            if val is not None:
                args.append(val)
                fields.append(f"{col} = ${len(args)}")

        if not fields:
            return await self.get_by_id(id)

        args.append(id)
        rows = await self._db.fetch(
            f"UPDATE model_configs SET {', '.join(fields)}, updated_at = NOW() "
            f"WHERE id = ${len(args)} "
            "RETURNING id, name, task_type, provider, endpoint_url, "
            "input_cost, output_cost, is_active, created_at, updated_at",
            *args,
        )
        return _row_to_model(rows[0]) if rows else None

    async def delete(self, id: UUID) -> bool:
        result = await self._db.execute(
            "DELETE FROM model_configs WHERE id = $1", id
        )
        return result.split()[-1] != "0"
